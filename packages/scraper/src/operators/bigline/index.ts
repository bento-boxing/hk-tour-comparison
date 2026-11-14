import type { OperatorScraper } from '../../types';
import { API_HOST, discover } from './discover';
import { createFetchPage } from './fetch-page';
import { readTour } from './parse';

export { API_HOST, DATES_URL, datesBody, detailUrl, discover, isTourUrl, tourIdOf } from './discover';
export { createFetchPage, joinTour, MAX_MONTHS_PER_TOUR, monthsToRequest, splitTour } from './fetch-page';
export { parse, readTour } from './parse';
export { publicDates, publicDetail, routeChunks } from './public';

/**
 * Big Line Holiday 大航假期, bigline.hk. Findings: docs/operators/bigline.md. Tours are found in the
 * bigline.hk sitemap; their facts come from the site's API, api.biglinehk.com: one detail GET, then one POST
 * per month of departures (at most MAX_MONTHS_PER_TOUR), joined by fetchPage for parse.
 */
export const biglineScraper: OperatorScraper = {
  id: 'bigline',
  discover,
  fetchPage: createFetchPage(),
  // A rejected page throws its reason (a fixed text, see readTour): the runner counts it as a parse failure
  // either way, and the crawl log then says why (the 2026-11-14 crawl could not: 19259, 19261).
  parse: (text, url) => {
    const tour = readTour(text, url);
    if ('why' in tour) throw new Error(tour.why);
    return tour;
  },
  // The one header the API needs (a fixed site key from the site's public JavaScript, the same for every
  // visitor). Owner approval 2026-11-13: this header, and Content-Type on the POST, to this host only;
  // no device id, cookie, Referer or anything else.
  requestHeaders: { [API_HOST]: { tenantCode: 'DH' } },
  // First-run floor, PROVISIONAL, cautious: about a sixth of the 586 tour URLs in the 2026-11-12 sitemap.
  // A third (as for EGL) assumes most tours have dates on sale, but 1 of the 4 tours sampled had none
  // (22042), and tours with no listed month are skipped as no-departures. No crawl has measured Big Line;
  // replace this with a third of the tours with dates once the measured crawl has run.
  minExpectedTours: 100,
};
