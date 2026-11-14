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
  // First-run floor: a third of the 153 tours the 2026-11-14 practice crawl would have saved (789 pages
  // fetched; most of the rest are old posts with no dates left). docs/operators/charming.md, "Practice crawl".
  minExpectedTours: 51,
};
