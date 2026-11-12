import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import robotsParser from 'robots-parser';
import type { Fetcher } from './types';

export const REQUEST_DELAY_MS = 3000;
export const REQUEST_TIMEOUT_MS = 30_000;
export const USER_AGENT = 'tour-comparison-bot/0.1';

/** A failed request (network error, timeout or 5xx) is tried at most this many more times. */
const MAX_RETRIES = 2;
const MAX_REDIRECTS = 5;
/** robots.txt answers that mean "there is no robots.txt": everything is allowed (RFC 9309). */
const NO_ROBOTS_STATUSES = [404, 410];

export interface FetcherOptions {
  userAgent?: string;                 // defaults to USER_AGENT
  delayMs?: number;                   // per host, between the starts of consecutive requests; defaults to REQUEST_DELAY_MS
  timeoutMs?: number;                 // per request; defaults to REQUEST_TIMEOUT_MS
  log?: (line: string) => void;       // defaults to console.log
}

/** What one HTTP request came back with. The body is read only for a 200. */
type Answer =
  | { kind: 'response'; status: number; location: string | null; body: string | null }
  | { kind: 'error'; message: string };

/** What a host's robots.txt lets us do. */
interface HostRules { isAllowed(url: string): boolean; crawlDelayMs: number }

/**
 * Runs one task at a time for one host, starting each at least `minGapMs`
 * after the previous one started and only after it has finished.
 */
class HostQueue {
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
 * request, and asks each host for one page at a time, spaced by the delay (or
 * by the host's Crawl-delay when that is longer). Redirects are followed by
 * hand so every hop is checked against robots.txt and spaced like any request.
 */
export function createFetcher(opts: FetcherOptions = {}): Fetcher {
  const userAgent = opts.userAgent ?? USER_AGENT;
  const delayMs = opts.delayMs ?? REQUEST_DELAY_MS;
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const log = opts.log ?? (line => console.log(line));

  const queues = new Map<string, HostQueue>();
  const rules = new Map<string, Promise<HostRules>>();

  function queueFor(origin: string): HostQueue {
    let queue = queues.get(origin);
    if (!queue) queues.set(origin, queue = new HostQueue(delayMs));
    return queue;
  }

  /** One HTTP request, through its host's queue. Never throws. */
  function request(url: URL): Promise<Answer> {
    return queueFor(url.origin).run(async (): Promise<Answer> => {
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
   * `mayRequest` decides whether that URL may be requested at all.
   * Returns the 200 body, or null after logging why not.
   */
  async function getFollowingRedirects(start: URL, mayRequest: (url: URL) => Promise<boolean>): Promise<
    { body: string } | { failure: Answer | 'disallowed' | 'redirects' }
  > {
    let url = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await mayRequest(url))) return { failure: 'disallowed' };
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

  async function loadRules(origin: string): Promise<HostRules> {
    const robotsUrl = new URL('/robots.txt', origin);
    const result = await getFollowingRedirects(robotsUrl, async () => true);
    if ('body' in result) {
      const robots = robotsParser(robotsUrl.href, result.body);
      const crawlDelaySeconds = robots.getCrawlDelay(userAgent) ?? 0;
      return {
        // undefined means the URL is not on this host; never treat that as allowed.
        isAllowed: url => robots.isAllowed(url, userAgent) === true,
        crawlDelayMs: Number.isFinite(crawlDelaySeconds) ? crawlDelaySeconds * 1000 : 0,
      };
    }
    const { failure } = result;
    if (typeof failure !== 'string' && failure.kind === 'response' && NO_ROBOTS_STATUSES.includes(failure.status)) {
      return { isAllowed: () => true, crawlDelayMs: 0 };
    }
    log(`robots.txt unreadable for ${origin} (${typeof failure === 'string' ? failure : describe(failure)}); requesting nothing from this host`);
    return { isAllowed: () => false, crawlDelayMs: 0 };
  }

  /** The host's robots.txt rules, fetched once per host; applies its Crawl-delay to the host's queue. */
  function rulesFor(origin: string): Promise<HostRules> {
    let hostRules = rules.get(origin);
    if (!hostRules) {
      hostRules = loadRules(origin).then(loaded => {
        const queue = queueFor(origin);
        queue.minGapMs = Math.max(queue.minGapMs, loaded.crawlDelayMs);
        return loaded;
      });
      rules.set(origin, hostRules);
    }
    return hostRules;
  }

  return {
    async fetchText(url) {
      const start = httpUrl(url);
      if (start === null) {
        log(`not an http(s) URL: ${url}`);
        return null;
      }
      const result = await getFollowingRedirects(start, async hop => (await rulesFor(hop.origin)).isAllowed(hop.href));
      if ('body' in result) return result.body;
      const { failure } = result;
      const why = failure === 'disallowed' ? 'disallowed by robots.txt'
        : failure === 'redirects' ? 'too many redirects'
        : describe(failure);
      log(`not fetched ${url}: ${why}`);
      return null;
    },
  };
}
