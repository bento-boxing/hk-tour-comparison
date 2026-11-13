import type { OperatorId, ScrapedTour } from '@hktours/core';

export interface Fetcher {
  /** One page. null if robots.txt disallows it, or the response is not 200. */
  fetchText(url: string): Promise<string | null>;
}

export interface OperatorScraper {
  id: OperatorId;
  /** URLs of tour pages to fetch tonight, already filtered to tour pages. */
  discover(fetcher: Fetcher): Promise<string[]>;
  /**
   * What `parse` receives for one discovered URL, fetched through the run's fetcher (never another network
   * path): for an operator whose facts need more than the page itself, such as EGL's dates request, the
   * responses joined into one text. null means the page could not be fetched (it counts toward checkRun's
   * fetch-failure rate, not as a parse failure). Unset: the page itself, `fetcher.fetchText(url)`.
   */
  fetchPage?(fetcher: Fetcher, url: string): Promise<string | null>;
  /** Pure function. null when the page is not a tour page or cannot be parsed. */
  parse(html: string, url: string): ScrapedTour | null;
  /**
   * Tours a run with no previous good run must save to pass its checks (checkRun's `below-minimum`),
   * so a sitemap caught mid-rebuild cannot pass an operator's first run. Unset: no floor.
   */
  minExpectedTours?: number;
}
