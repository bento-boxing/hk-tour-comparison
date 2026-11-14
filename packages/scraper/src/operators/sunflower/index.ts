import type { OperatorScraper } from '../../types';
import { bookingUrl, discoverTours } from './discover';
import { createFetchPage } from './fetch-page';
import { readTour } from './parse';
import type { PublicEntry } from './public';

export { bookingUrl, codeOf, discoverTours, isTourUrl, LISTING_URL, readListing } from './discover';
export { createFetchPage, joinPage, splitPage } from './fetch-page';
export { laterDates, parse, readTour } from './parse';
export { publicBookingPage, publicEntry } from './public';

/**
 * Sunflower Travel 新華旅遊, www.sunflower.com.hk. Findings: docs/operators/sunflower.md. Owner approval 2026-11-14:
 * a reduced listing. The listing JSON is read once a night (every region in one answer); each tour with an online
 * booking code is then one GET of its booking page (its days and one calendar month of dates and prices), joined
 * by fetchPage with its listing entry (title, route, "from" price, later dates without a year). About 371 requests
 * a night. Discovery fills the entries fetchPage joins, so one scraper serves one run.
 */
export function createSunflowerScraper(opts: { log?: (line: string) => void } = {}): OperatorScraper {
  const log = opts.log ?? (line => console.log(line));
  const entries = new Map<string, PublicEntry>();
  return {
    id: 'sunflower',
    discover: async fetcher => {
      const tours = await discoverTours(fetcher, log);
      entries.clear();
      for (const tour of tours) entries.set(tour.ItinCode, tour);
      return tours.map(tour => bookingUrl(tour.ItinCode));
    },
    fetchPage: createFetchPage(code => entries.get(code)),
    // A rejected page throws its reason (a fixed text, see readTour), so the crawl log says why.
    parse: (text, url) => {
      const tour = readTour(text, url);
      if ('why' in tour) throw new Error(tour.why);
      return tour;
    },
    // First-run floor, PROVISIONAL: 60% of the 370 tours with a booking code the listing held on 2026-11-14, rounded
    // down. No crawl has been measured yet; a measured crawl sets the real floor, and only then does sunflower join
    // the nightly matrix (docs/operators/sunflower.md, "Scraper").
    minExpectedTours: 222,
  };
}

export const sunflowerScraper: OperatorScraper = createSunflowerScraper();
