import type { OperatorScraper } from '../../types';
import { discover } from './discover';
import { parse } from './parse';

export { discover, isTourUrl } from './discover';
export { parse } from './parse';

/** Jetour 捷旅, www.jetour.com.hk. Findings: docs/operators/jetour.md. */
export const jetourScraper: OperatorScraper = {
  id: 'jetour',
  discover,
  parse: (html, url) => parse(html, url),
  // First-run floor: about a third of the tours that had dates on sale in the 2026-11-13 confirmation crawl (99 of 453 pages).
  minExpectedTours: 35,
};
