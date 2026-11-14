import type { OperatorScraper } from '../../types';
import { discover } from './discover';
import { parse } from './parse';

export { discover, isTourUrl, listUrl } from './discover';
export { parse } from './parse';

/**
 * Charming Holidays 翠明假期, www.charming-online.com. Findings: docs/operators/charming.md.
 * Discovery reads the site's WordPress REST list of tour posts (8 requests for 789 posts on 2026-11-13);
 * each tour is then one request, its page, which holds every fact.
 */
export const charmingScraper: OperatorScraper = {
  id: 'charming',
  discover,
  parse: (html, url) => parse(html, url),
  // First-run floor, PROVISIONAL and cautious: of the 789 posts most are old tours with no dates left (a 2023
  // post still lists its 2023 date), and how many have dates on sale is not known. The 100 newest posts were
  // all modified from August 2026 on; this assumes at least 120 tours have dates on sale and takes a third.
  // Replace it with a third of the tours with dates once the measured crawl has run.
  minExpectedTours: 40,
};
