import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import robotsParser from 'robots-parser';
import type { Fetcher } from './types';

export const REQUEST_DELAY_MS = 3000;
export const REQUEST_TIMEOUT_MS = 30_000;
export const USER_AGENT = 'tour-comparison-bot/0.1';
/** A robots.txt Crawl-delay above this means "do not crawl": that origin gets no page requests at all. */
export const MAX_CRAWL_DELAY_MS = 30_000;

/**
 * After this many page answers in a row from one site that push back (PUSHBACK_STATUSES), the site
 * gets no more page requests for the rest of the process. A 2xx page answer starts the count again.
 */
export const MAX_CONSECUTIVE_PUSHBACK = 3;

/** Page answers that mean "you are not welcome" or "slow down": they count toward MAX_CONSECUTIVE_PUSHBACK. */
const PUSHBACK_STATUSES = [403, 429, 503];
/**
 * A failed request (network error, timeout, or 5xx other than a 503 with Retry-After) is tried
 * at most this many more times.
 */
const MAX_RETRIES = 2;
const MAX_REDIRECTS = 5;
/** robots.txt answers that mean "there is no robots.txt": everything is allowed (RFC 9309). */
const NO_ROBOTS_STATUSES = [404, 410];

export interface FetcherOptions {
  userAgent?: string;                 // defaults to USER_AGENT
  delayMs?: number;                   // per site, from the end of one request to the start of the next; defaults to REQUEST_DELAY_MS
  timeoutMs?: number;                 // per request; defaults to REQUEST_TIMEOUT_MS
  log?: (line: string) => void;       // defaults to console.log
  /**
   * Extra request headers by host name (`api.example.com`, any case), which means `https://` on the
   * default port only, or by an exact http(s) origin (`http://127.0.0.1:8080`, for tests). Sent on every
   * page request (GET or POST) to exactly that origin, never to any other: not to the host over `http://`
   * or on another port, not to another host, not even on a redirect hop (each hop is matched on its own
   * origin), and never on robots.txt. They cannot replace the User-Agent (or a POST's
   * Content-Type). Headers that cannot be sent (an invalid name or value, or one that throws when read)
   * fail that one request, logged, without sending it; it is not retried.
   */
  extraHeaders?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** createFetcher's fetcher: pages as text, or as raw bytes for binary files such as PDFs. */
export interface PoliteFetcher extends Fetcher {
  /** One file's exact bytes, under the same rules as fetchText. null whenever fetchText would be. */
  fetchBytes(url: string): Promise<Uint8Array | null>;
  /**
   * POSTs `body` as JSON (Content-Type: application/json) and returns the 200 answer's text, or null
   * (logged). Same robots.txt check, site queue, spacing, extraHeaders and pushback counting as a GET,
   * but sent exactly once: a POST may not be safe to repeat, so it is never retried (not even after
   * a network error, timeout or 5xx), and a redirect answer is not followed. A body JSON.stringify
   * cannot turn into JSON is not sent, and robots.txt is not even asked.
   */
  postJson(url: string, body: unknown): Promise<string | null>;
}

/** A POST and its JSON text. */
interface PostJson { json: string }

/**
 * The key requests are queued and spaced by: the host name, lower-cased, without a
 * leading `www.`, ignoring scheme and port. So http://, https://, www. and other ports
 * of one server share one queue.
 */
export function siteOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

/**
 * What one HTTP request came back with. The body is read only for a 200.
 * `retryAfter`: the response carried a Retry-After header.
 * `not-sent`: the request was never sent, because its site was refused while it waited, or its
 * extra headers could not be sent. Final: not retried.
 */
type Answer =
  | { kind: 'response'; status: number; location: string | null; body: Uint8Array | null; retryAfter: boolean }
  | { kind: 'error'; message: string }
  | { kind: 'not-sent'; why: string };

/**
 * What one origin's robots.txt lets us do. A non-null `refusal` means no page at all
 * may be requested from the origin (robots.txt unreadable, or Crawl-delay over the cap),
 * and says why.
 */
interface OriginRules { refusal: string | null; isAllowed(url: string): boolean; crawlDelayMs: number }

/**
 * Runs one task at a time for one site, starting each at least `minGapMs` after
 * the previous one finished (so also at least `minGapMs` after it started).
 * Counting from the finish keeps the gap the server sees at or above `minGapMs`
 * even when one request took longer to reach it (a new connection, say) than the next.
 */
class SiteQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private lastEnd = -Infinity;

  constructor(public minGapMs: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => {
      // Timers can fire a fraction of a millisecond early, so re-check before starting.
      for (let wait = this.waitMs(); wait > 0; wait = this.waitMs()) await sleep(wait);
      try {
        return await task();
      } finally {
        this.lastEnd = performance.now();
      }
    });
    this.tail = result.catch(() => undefined);
    return result;
  }

  private waitMs(): number {
    return this.lastEnd + this.minGapMs - performance.now();
  }
}

const isRedirect = (status: number) => [301, 302, 303, 307, 308].includes(status);
/** A network error or a 5xx, except a 503 that says when to come back (Retry-After): that one is final. */
const isRetryable = (answer: Answer) => answer.kind === 'error'
  || (answer.kind === 'response' && answer.status >= 500 && !(answer.status === 503 && answer.retryAfter));
/** UTF-8 with replacement characters, as Response.text() decodes. */
const decodeText = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const describe = (answer: Answer) =>
  (answer.kind === 'error' ? answer.message : answer.kind === 'not-sent' ? answer.why : `HTTP ${answer.status}`);

/** The URL as a parsed http(s) URL, or null. */
function httpUrl(url: string, base?: URL): URL | null {
  try {
    const parsed = new URL(url, base);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

/** A bare host name, as an extraHeaders key. */
const HOST_NAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

/**
 * The origin an extraHeaders key names: `https://<host>` (default port) for a bare host name, or the key's
 * own origin for an http(s) origin. Throws for anything else, so a mistyped key cannot widen where headers go.
 */
function headersOrigin(key: string): string {
  if (HOST_NAME.test(key)) return `https://${key.toLowerCase()}`;
  const origin = httpUrl(key);
  if (origin === null || !key.includes('://') || origin.href.replace(/\/$/, '') !== origin.origin) {
    throw new Error(`extraHeaders key ${JSON.stringify(key)} is neither a host name nor an origin`);
  }
  return origin.origin;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/**
 * A Fetcher that obeys robots.txt, sends the same honest User-Agent on every
 * request, and asks each site (see `siteOf`) for one page at a time, spaced by
 * the delay (or by the site's Crawl-delay when that is longer). robots.txt is
 * read per origin. Redirects are followed by hand so every hop is checked
 * against robots.txt and spaced like any request.
 */
export function createFetcher(opts: FetcherOptions = {}): PoliteFetcher {
  const userAgent = opts.userAgent ?? USER_AGENT;
  const delayMs = opts.delayMs ?? REQUEST_DELAY_MS;
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const log = opts.log ?? (line => console.log(line));
  /** By origin. */
  const extraHeaders = new Map(Object.entries(opts.extraHeaders ?? {}).map(([key, headers]) => [headersOrigin(key), headers]));

  const queues = new Map<string, SiteQueue>();              // by site
  const rules = new Map<string, Promise<OriginRules>>();    // by origin
  /** Sites that must get no more page requests, with why. Once refused, a site stays refused. */
  const refusedSites = new Map<string, string>();
  /** By site: how many page answers in a row pushed back (PUSHBACK_STATUSES). */
  const pushbackInARow = new Map<string, number>();

  function queueFor(url: URL): SiteQueue {
    const site = siteOf(url);
    let queue = queues.get(site);
    if (!queue) queues.set(site, queue = new SiteQueue(delayMs));
    return queue;
  }

  /**
   * Counts a page answer toward its site's pushback: a 2xx starts the count again, a pushback
   * status adds one, and the MAX_CONSECUTIVE_PUSHBACK-th in a row refuses the site.
   */
  function notePageAnswer(url: URL, status: number): void {
    const site = siteOf(url);
    if (status >= 200 && status < 300) {
      pushbackInARow.delete(site);
      return;
    }
    if (!PUSHBACK_STATUSES.includes(status)) return;
    const inARow = (pushbackInARow.get(site) ?? 0) + 1;
    pushbackInARow.set(site, inARow);
    if (inARow >= MAX_CONSECUTIVE_PUSHBACK && !refusedSites.has(site)) {
      refuseSite(url,
        `the site answered with HTTP ${status} ${MAX_CONSECUTIVE_PUSHBACK} times in a row and is not being requested further`);
    }
  }

  /**
   * The headers for one request: the extra headers declared for exactly this URL's host (page requests
   * only), then a POST's Content-Type and the User-Agent, set last so nothing can replace them. Throws
   * when the extra headers cannot be sent.
   */
  function headersFor(url: URL, isPage: boolean, post: boolean): Headers {
    const headers = new Headers(isPage ? extraHeaders.get(url.origin) : undefined);
    if (post) headers.set('content-type', 'application/json');
    headers.set('user-agent', userAgent);
    return headers;
  }

  /**
   * One HTTP request, through its site's queue. Never throws. A page request whose
   * site was refused while it waited in the queue is not sent, nor is one whose extra headers
   * cannot be sent. Page answers count toward the site's pushback (robots.txt answers do not).
   * Page requests carry their host's extraHeaders; `post` makes it a POST with that JSON body.
   */
  function request(url: URL, isPage: boolean, post?: PostJson): Promise<Answer> {
    return queueFor(url).run(async (): Promise<Answer> => {
      const siteRefusal = isPage ? refusedSites.get(siteOf(url)) : undefined;
      if (siteRefusal !== undefined) return { kind: 'not-sent', why: siteRefusal };
      let headers: Headers;
      try {
        headers = headersFor(url, isPage, post !== undefined);
      } catch (error) {
        // Only the error's name: the message may quote a header value.
        const name = error instanceof Error ? error.name : typeof error;
        return { kind: 'not-sent', why: `the extra headers for ${url.hostname} cannot be sent (${name}), so nothing was sent` };
      }
      let res: Response;
      try {
        res = await fetch(url, {
          method: post ? 'POST' : 'GET',
          body: post?.json,
          headers,
          redirect: 'manual',
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        return { kind: 'error', message: errorMessage(error) };
      }
      if (isPage) notePageAnswer(url, res.status);
      try {
        const retryAfter = res.headers.has('retry-after');
        if (res.status === 200) {
          return { kind: 'response', status: 200, location: null, body: new Uint8Array(await res.arrayBuffer()), retryAfter };
        }
        await res.body?.cancel().catch(() => undefined); // the status is the answer, not a network error
        return { kind: 'response', status: res.status, location: res.headers.get('location'), body: null, retryAfter };
      } catch (error) {
        return { kind: 'error', message: errorMessage(error) };
      }
    });
  }

  /**
   * One request, tried again up to MAX_RETRIES times after a network error or 5xx (but not a 503
   * with Retry-After). 4xx is final.
   */
  async function requestWithRetries(url: URL, isPage: boolean): Promise<Answer> {
    let answer = await request(url, isPage);
    for (let retry = 1; retry <= MAX_RETRIES && isRetryable(answer); retry++) {
      log(`retry ${retry}/${MAX_RETRIES} ${url.href}: ${describe(answer)}`);
      answer = await request(url, isPage);
    }
    return answer;
  }

  /**
   * Requests `start`, following up to MAX_REDIRECTS redirects. Before each hop,
   * `whyNot` says whether that URL may be requested at all (null) or why not.
   * Returns the 200 body, or why there is none and the URL (`at`) where that happened.
   */
  async function getFollowingRedirects(
    start: URL, isPage: boolean, whyNot: (url: URL) => Promise<string | null>,
  ): Promise<{ body: Uint8Array } | { failure: Answer | string; at: URL }> {
    let url = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const refusal = await whyNot(url);
      if (refusal !== null) return { failure: refusal, at: url };
      const answer = await requestWithRetries(url, isPage);
      if (answer.kind === 'response' && answer.status === 200) return { body: answer.body ?? new Uint8Array() };
      const next = answer.kind === 'response' && isRedirect(answer.status) && answer.location !== null
        ? httpUrl(answer.location, url)
        : null;
      if (next === null) return { failure: answer, at: url };
      url = next;
    }
    return { failure: 'too many redirects', at: url };
  }

  /** Rules that refuse every page request to one origin; logged once, here. */
  function refuseOrigin(origin: string, why: string): OriginRules {
    log(`not crawling ${origin}: ${why}`);
    return { refusal: `origin ${origin} is not crawled: ${why}`, isAllowed: () => false, crawlDelayMs: 0 };
  }

  /** Refuses every later page request to any origin of the site; logged once, here. */
  function refuseSite(url: URL, why: string): OriginRules {
    const site = siteOf(url);
    log(`not crawling site ${site}: ${why}`);
    const refusal = `site ${site} is not crawled: ${why}`;
    refusedSites.set(site, refusal);
    return { refusal, isAllowed: () => false, crawlDelayMs: 0 };
  }

  async function loadRules(originUrl: URL): Promise<OriginRules> {
    const { origin } = originUrl;
    const robotsUrl = new URL('/robots.txt', origin);
    const result = await getFollowingRedirects(robotsUrl, false, async () => null);
    if ('body' in result) {
      const robots = robotsParser(robotsUrl.href, decodeText(result.body));
      const crawlDelaySeconds = robots.getCrawlDelay(userAgent) ?? 0;
      const crawlDelayMs = Number.isFinite(crawlDelaySeconds) ? crawlDelaySeconds * 1000 : 0;
      if (crawlDelayMs > MAX_CRAWL_DELAY_MS) {
        return refuseSite(originUrl,
          `robots.txt at ${origin} asks for Crawl-delay ${crawlDelaySeconds} s, over the ${MAX_CRAWL_DELAY_MS / 1000} s cap`);
      }
      return {
        refusal: null,
        // undefined means the URL is not on this origin; never treat that as allowed.
        isAllowed: url => robots.isAllowed(url, userAgent) === true,
        crawlDelayMs,
      };
    }
    const { failure } = result;
    if (typeof failure !== 'string' && failure.kind === 'response' && NO_ROBOTS_STATUSES.includes(failure.status)) {
      return { refusal: null, isAllowed: () => true, crawlDelayMs: 0 };
    }
    return refuseOrigin(origin, `robots.txt unreadable (${typeof failure === 'string' ? failure : describe(failure)})`);
  }

  /**
   * The origin's robots.txt rules, fetched once per origin (RFC 9309). Its Crawl-delay
   * applies to the whole site's queue, so a site gets the largest delay any of its origins asks for.
   */
  function rulesFor(url: URL): Promise<OriginRules> {
    let originRules = rules.get(url.origin);
    if (!originRules) {
      originRules = loadRules(url).then(loaded => {
        const queue = queueFor(url);
        queue.minGapMs = Math.max(queue.minGapMs, loaded.crawlDelayMs);
        return loaded;
      });
      rules.set(url.origin, originRules);
    }
    return originRules;
  }

  /**
   * null when the page may be requested, otherwise why not. A refused site is refused
   * before its origin's robots.txt is even read; the site is checked again after reading,
   * since reading it (or another origin's) may have refused the site meanwhile.
   */
  async function whyNotAllowed(url: URL): Promise<string | null> {
    const site = siteOf(url);
    const before = refusedSites.get(site);
    if (before !== undefined) return before;
    const originRules = await rulesFor(url);
    const refusal = refusedSites.get(site) ?? originRules.refusal;
    if (refusal !== null) return refusal;
    return originRules.isAllowed(url.href) ? null : 'disallowed by robots.txt';
  }

  /** One page's bytes, or null (logged) when it may not be requested or did not answer 200. */
  async function fetchBody(url: string): Promise<Uint8Array | null> {
    const start = httpUrl(url);
    if (start === null) {
      log(`not an http(s) URL: ${url}`);
      return null;
    }
    const result = await getFollowingRedirects(start, true, whyNotAllowed);
    if ('body' in result) return result.body;
    const { failure, at } = result;
    const why = typeof failure === 'string' ? failure : describe(failure);
    const where = at.href === start.href ? '' : ` (redirected to ${at.href})`;
    log(`not fetched ${url}${where}: ${why}`);
    return null;
  }

  /** See PoliteFetcher.postJson: checked like a page, sent once, never retried or redirected. */
  async function postJson(url: string, body: unknown): Promise<string | null> {
    let json: string | undefined;
    try {
      json = JSON.stringify(body);
    } catch (error) {
      log(`not fetched ${url} (POST): the body is not JSON (${error instanceof Error ? error.name : typeof error})`);
      return null;
    }
    if (json === undefined) {
      log(`not fetched ${url} (POST): the body is not JSON (${typeof body})`);
      return null;
    }
    const target = httpUrl(url);
    if (target === null) {
      log(`not an http(s) URL: ${url}`);
      return null;
    }
    const answer = await whyNotAllowed(target) ?? await request(target, true, { json });
    if (typeof answer !== 'string' && answer.kind === 'response' && answer.status === 200) {
      return decodeText(answer.body ?? new Uint8Array());
    }
    log(`not fetched ${url} (POST, not retried): ${typeof answer === 'string' ? answer : describe(answer)}`);
    return null;
  }

  return {
    async fetchText(url) {
      const body = await fetchBody(url);
      return body === null ? null : decodeText(body);
    },
    fetchBytes: fetchBody,
    postJson,
  };
}
