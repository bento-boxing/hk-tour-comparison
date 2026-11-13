import type { IsoDate, OperatorId, ScrapedTour } from '@hktours/core';

export interface Fetcher {
  /** One page. null if robots.txt disallows it, or the response is not 200. */
  fetchText(url: string): Promise<string | null>;
  /**
   * POSTs `body` as JSON and returns the 200 answer's text, or null; never retried (see PoliteFetcher).
   * Optional, so a test fake need not have it; the run's real fetcher (createFetcher) always does.
   */
  postJson?(url: string, body: unknown): Promise<string | null>;
}

/**
 * fetchPage's answer for a tour page the operator says no longer exists (such as Big Line's API answering
 * `404 NOT_FOUND` for a sitemap tour): the runner skips it, logged, as neither fetched nor a fetch failure.
 */
export interface PageSkip { skip: 'gone' }

/** Extra request headers by exact host name, for `OperatorScraper.requestHeaders`. */
export type RequestHeaders = Readonly<Record<string, Readonly<Record<string, string>>>>;

export interface OperatorScraper {
  id: OperatorId;
  /** URLs of tour pages to fetch tonight, already filtered to tour pages. */
  discover(fetcher: Fetcher): Promise<string[]>;
  /**
   * What `parse` receives for one discovered URL, fetched through the run's fetcher (never another network
   * path): for an operator whose facts need more than the page itself, such as EGL's dates request, the
   * responses joined into one text. null means the page could not be fetched (it counts toward checkRun's
   * fetch-failure rate, not as a parse failure; so does a fetchPage that throws). A PageSkip: the tour is
   * gone, skipped. `today` is the run's date in Hong Kong. Unset: the page itself, `fetcher.fetchText(url)`.
   */
  fetchPage?(fetcher: Fetcher, url: string, today: IsoDate): Promise<string | PageSkip | null>;
  /**
   * Extra headers the operator's own site needs, by exact host name (such as Big Line's API key header for
   * `api.biglinehk.com`). The CLI gives them to this operator's fetcher only, and the fetcher sends them
   * only to that host (never to robots.txt, nor to another host a redirect leads to). Unset: none.
   */
  requestHeaders?: RequestHeaders;
  /** Pure function. null when the page is not a tour page or cannot be parsed. */
  parse(html: string, url: string): ScrapedTour | null;
  /**
   * Tours a run with no previous good run must save to pass its checks (checkRun's `below-minimum`),
   * so a sitemap caught mid-rebuild cannot pass an operator's first run. Unset: no floor.
   */
  minExpectedTours?: number;
}
