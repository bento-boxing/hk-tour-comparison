import type { OperatorId, ScrapedTour } from '@hktours/core';

export interface Fetcher {
  /** One page. null if robots.txt disallows it, or the response is not 200. */
  fetchText(url: string): Promise<string | null>;
}

export interface OperatorScraper {
  id: OperatorId;
  /** URLs of tour pages to fetch tonight, already filtered to tour pages. */
  discover(fetcher: Fetcher): Promise<string[]>;
  /** Pure function. null when the page is not a tour page or cannot be parsed. */
  parse(html: string, url: string): ScrapedTour | null;
  /**
   * Tours a run with no previous good run must save to pass its checks (checkRun's `below-minimum`),
   * so a sitemap caught mid-rebuild cannot pass an operator's first run. Unset: no floor.
   */
  minExpectedTours?: number;
}
