import { PUBLIC_LOG, type LogView } from '../../public-log';
import type { OperatorScraper } from '../../types';
import { tourOrThrow } from '../shared/joined';
import { ALLOWED_HOSTS, discoverTours } from './discover';
import { createFetchPage } from './fetch-page';
import { readTour } from './parse';

export { ALLOWED_HOSTS, discoverTours, eventUrl, isTourUrl, listUrl, MAX_LIST_PAGES, readListPage, tourIdOf, tourPageUrl } from './discover';
export { createFetchPage, joinPage, splitPage } from './fetch-page';
export { gatheringPoint, parse, readTour } from './parse';
export { BOOKABLE_STATUSES, publicDates, publicTourPage } from './public';

/**
 * Taste Travel 味力之旅, tastetravel.com.hk. Findings: docs/operators/taste.md. Owner approval 2026-11-19: a reduced
 * listing. The list is read page by page (10 tours a page, 32 pages on 2026-11-20); each group tour is then one GET of
 * its page (code, title, days, day lines, gathering point, "from" price) and one of its dates answer (every date with
 * a status, no price). Every date is shown at the tour's "from" price, marked 起; the site shows no full marker, so a
 * full date may be listed as bookable. About 654 requests a night. Discovery sets the run's log view, which fetchPage
 * logs through, so one scraper serves one run.
 */
export function createTasteScraper(opts: { log?: (line: string) => void } = {}): OperatorScraper {
  const log = opts.log ?? (line => console.log(line));
  let view: LogView = PUBLIC_LOG;
  return {
    id: 'taste',
    discover: async (fetcher, logView = PUBLIC_LOG) => {
      view = logView;
      return discoverTours(fetcher, log, logView);
    },
    fetchPage: createFetchPage(log, () => view),
    allowedHosts: ALLOWED_HOSTS,
    // A rejected page throws its reason (a fixed text, see readTour), so the crawl log says why.
    parse: (text, url) => tourOrThrow(readTour(text, url)),
    // First-run floor: a third of the 279 tours the 2026-11-20 practice crawl would save with the task 48 changes
    // (311 pages fetched; 274 saved as crawled, re-processed offline; 30 with no departures, 2 with no stops).
    // docs/operators/taste.md, "Practice crawl (2026-11-20) and task 48".
    minExpectedTours: 93,
  };
}

export const tasteScraper: OperatorScraper = createTasteScraper();
