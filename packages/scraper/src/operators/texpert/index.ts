import type { OperatorScraper } from '../../types';
import { ALLOWED_HOSTS, discover } from './discover';
import { parse } from './parse';

export { ALLOWED_HOSTS, discover, isTourUrl } from './discover';
export { parse } from './parse';

/** Travel Expert 專業旅運, www.texpert.com. Findings: docs/operators/texpert.md. */
export const texpertScraper: OperatorScraper = {
  id: 'texpert',
  discover,
  parse: (html, url) => parse(html, url),
  allowedHosts: ALLOWED_HOSTS,
  // First-run floor: about a third of the tours that had dates on sale in the 2026-11-13 confirmation crawl (112 of 117 pages).
  minExpectedTours: 40,
};
