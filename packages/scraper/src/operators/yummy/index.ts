import type { OperatorScraper } from '../../types';
import { discover } from './discover';
import { createFetchPage } from './fetch-page';
import { readTour } from './parse';

export { datesUrl, detailUrl, discover, isTourUrl, LISTING_URL, tourIdOf, tourPageUrl } from './discover';
export { createFetchPage, joinTour, splitTour } from './fetch-page';
export { parse, readTour } from './parse';
export { publicDates, publicDetail, publicListing } from './public';

/**
 * Yummy Holiday 美味假期, www.yummyholiday.net. Findings: docs/operators/yummy.md. Everything comes from the
 * site's public JSON API, api.yummyholiday.net, by plain GETs with no extra headers: the listing once a night
 * (every tour on one page), then each tour's detail (code, title, days, "from" price, city list) and dates
 * (each group's status and price), joined by fetchPage for parse. About 655 requests a night for 327 tours.
 */
export const yummyScraper: OperatorScraper = {
  id: 'yummy',
  discover,
  fetchPage: createFetchPage(),
  // A rejected page throws its reason (a fixed text, see readTour): the runner counts it as a parse failure
  // either way, and the crawl log then says why.
  parse: (text, url) => {
    const tour = readTour(text, url);
    if ('why' in tour) throw new Error(tour.why);
    return tour;
  },
  // First-run floor, PROVISIONAL: 60% of the 327 tours the listing held on 2026-11-14, rounded down. No crawl
  // has been measured yet (every listed tour had a departure then); a measured crawl sets the real floor, and
  // only then does yummy join the nightly matrix (docs/operators/yummy.md, "Scraper").
  minExpectedTours: 196,
};
