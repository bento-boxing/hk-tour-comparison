import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import robotsParser from 'robots-parser';
import type { Fetcher } from './types';

export const REQUEST_DELAY_MS = 3000;
export const REQUEST_TIMEOUT_MS = 30_000;
export const USER_AGENT = 'tour-comparison-bot/0.1';
/** A robots.txt Crawl-delay above this means "do not crawl": that origin gets no page requests at all. */
export const MAX_CRAWL_DELAY_MS = 30_000;

/** A failed request (network error, timeout or 5xx) is tried at most this many more times. */
const MAX_RETRIES = 2;
const MAX_REDIRECTS = 5;
/** robots.txt answers that mean "there is no robots.txt": everything is allowed (RFC 9309). */
const NO_ROBOTS_STATUSES = [404, 410];

export interface FetcherOptions {
  userAgent?: string;                 // defaults to USER_AGENT
  delayMs?: number;                   // per site, between the starts of consecutive requests; defaults to REQUEST_DELAY_MS
  timeoutMs?: number;                 // per request; defaults to REQUEST_TIMEOUT_MS
  log?: (line: string) => void;       // defaults to console.log
}

/**
 * The key requests are queued and spaced by: the host name, lower-cased, without a
 * leading `www.`, ignoring scheme and port. So http://, https://, www. and other ports
 * of one server share one queue.
 */
export function siteOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

/** What one HTTP request came back with. The body is read only for a 200. */
type Answer =
  | { kind: 'response'; status: number; location: string | null; body: string | null }
  | { kind: 'error'; message: string };

/**
 * What one origin's robots.txt lets us do. `refused` means nothing at all may be
 * requested from the origin (robots.txt unreadable, or Crawl-delay over the cap).
 */
interface OriginRules { refused: boolean; isAllowed(url: string): boolean; crawlDelayMs: number }

/**
 * Runs one task at a time for one site, starting each at least `minGapMs`
 * after the previous one started and only after it has finished.
 */
class SiteQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private lastStart = -Infinity;

  constructor(public minGapMs: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => {
      // Timers can fire a fraction of a millisecond early, so re-check before starting.
      for (let wait = this.waitMs(); wait > 0; wait = this.waitMs()) await sleep(wait);
      this.lastStart = performance.now();
      return task();
    });
    this.tail = result.catch(() => undefined);
    return result;
  }

  private waitMs(): number {
    return this.lastStart + this.minGapMs - performance.now();
  }
}

const isRedirect = (status: number) => [301, 302, 303, 307, 308].includes(status);
const isRetryable = (answer: Answer) => answer.kind === 'error' || answer.status >= 500;
const describe = (answer: Answer) => (answer.kind === 'error' ? answer.message : `HTTP ${answer.status}`);

/** The URL as a parsed http(s) URL, or null. */
function httpUrl(url: string, base?: URL): URL | null {
  try {
    const parsed = new URL(url, base);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
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
export function createFetcher(opts: FetcherOptions = {}): Fetcher {
  const userAgent = opts.userAgent ?? USER_AGENT;
  const delayMs = opts.delayMs ?? REQUEST_DELAY_MS;
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const log = opts.log ?? (line => console.log(line));

  const queues = new Map<string, SiteQueue>();              // by site
  const rules = new Map<string, Promise<OriginRules>>();    // by origin

  function queueFor(url: URL): SiteQueue {
    const site = siteOf(url);
    let queue = queues.get(site);
    if (!queue) queues.set(site, queue = new SiteQueue(delayMs));
    return queue;
  }

  /** One HTTP request, through its site's queue. Never throws. */
  function request(url: URL): Promise<Answer> {
    return queueFor(url).run(async (): Promise<Answer> => {
      try {
        const res = await fetch(url, {
          headers: { 'user-agent': userAgent },
          redirect: 'manual',
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.status === 200) return { kind: 'response', status: 200, location: null, body: await res.text() };
        await res.body?.cancel().catch(() => undefined); // the status is the answer, not a network error
        return { kind: 'response', status: res.status, location: res.headers.get('location'), body: null };
      } catch (error) {
        return { kind: 'error', message: errorMessage(error) };
      }
    });
  }

  /** One request, tried again up to MAX_RETRIES times after a network error or 5xx. 4xx is final. */
  async function requestWithRetries(url: URL): Promise<Answer> {
    let answer = await request(url);
    for (let retry = 1; retry <= MAX_RETRIES && isRetryable(answer); retry++) {
      log(`retry ${retry}/${MAX_RETRIES} ${url.href}: ${describe(answer)}`);
      answer = await request(url);
    }
    return answer;
  }

  /**
   * Requests `start`, following up to MAX_REDIRECTS redirects. Before each hop,
   * `whyNot` says whether that URL may be requested at all (null) or why not.
   * Returns the 200 body, or why there is none.
   */
  async function getFollowingRedirects<Why extends string>(start: URL, whyNot: (url: URL) => Promise<Why | null>): Promise<
    { body: string } | { failure: Answer | Why | 'redirects' }
  > {
    let url = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const refusal = await whyNot(url);
      if (refusal !== null) return { failure: refusal };
      const answer = await requestWithRetries(url);
      if (answer.kind === 'response' && answer.status === 200) return { body: answer.body ?? '' };
      const next = answer.kind === 'response' && isRedirect(answer.status) && answer.location !== null
        ? httpUrl(answer.location, url)
        : null;
      if (next === null) return { failure: answer };
      url = next;
    }
    return { failure: 'redirects' };
  }

  /** Rules that refuse every request to an origin; `why` is logged once, here. */
  function refuseAll(origin: string, why: string): OriginRules {
    log(`not crawling ${origin}: ${why}`);
    return { refused: true, isAllowed: () => false, crawlDelayMs: 0 };
  }

  async function loadRules(origin: string): Promise<OriginRules> {
    const robotsUrl = new URL('/robots.txt', origin);
    const result = await getFollowingRedirects(robotsUrl, async () => null);
    if ('body' in result) {
      const robots = robotsParser(robotsUrl.href, result.body);
      const crawlDelaySeconds = robots.getCrawlDelay(userAgent) ?? 0;
      const crawlDelayMs = Number.isFinite(crawlDelaySeconds) ? crawlDelaySeconds * 1000 : 0;
      if (crawlDelayMs > MAX_CRAWL_DELAY_MS) {
        return refuseAll(origin, `robots.txt Crawl-delay ${crawlDelaySeconds} s is over ${MAX_CRAWL_DELAY_MS / 1000} s`);
      }
      return {
        refused: false,
        // undefined means the URL is not on this origin; never treat that as allowed.
        isAllowed: url => robots.isAllowed(url, userAgent) === true,
        crawlDelayMs,
      };
    }
    const { failure } = result;
    if (typeof failure !== 'string' && failure.kind === 'response' && NO_ROBOTS_STATUSES.includes(failure.status)) {
      return { refused: false, isAllowed: () => true, crawlDelayMs: 0 };
    }
    return refuseAll(origin, `robots.txt unreadable (${typeof failure === 'string' ? failure : describe(failure)})`);
  }

  /**
   * The origin's robots.txt rules, fetched once per origin (RFC 9309). Its Crawl-delay
   * applies to the whole site's queue, so a site gets the largest delay any of its origins asks for.
   */
  function rulesFor(url: URL): Promise<OriginRules> {
    let originRules = rules.get(url.origin);
    if (!originRules) {
      originRules = loadRules(url.origin).then(loaded => {
        const queue = queueFor(url);
        queue.minGapMs = Math.max(queue.minGapMs, loaded.crawlDelayMs);
        return loaded;
      });
      rules.set(url.origin, originRules);
    }
    return originRules;
  }

  /** null when robots.txt lets us request the URL, otherwise why not. */
  async function whyNotAllowed(url: URL): Promise<'refused' | 'disallowed' | null> {
    const originRules = await rulesFor(url);
    if (originRules.refused) return 'refused';
    return originRules.isAllowed(url.href) ? null : 'disallowed';
  }

  return {
    async fetchText(url) {
      const start = httpUrl(url);
      if (start === null) {
        log(`not an http(s) URL: ${url}`);
        return null;
      }
      const result = await getFollowingRedirects(start, whyNotAllowed);
      if ('body' in result) return result.body;
      const { failure } = result;
      if (failure === 'refused') return null; // already logged once for the origin
      const why = failure === 'disallowed' ? 'disallowed by robots.txt'
        : failure === 'redirects' ? 'too many redirects'
        : describe(failure);
      log(`not fetched ${url}: ${why}`);
      return null;
    },
  };
}
