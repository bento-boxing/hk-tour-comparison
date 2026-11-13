import { readSitemapUrls } from '../../sitemap';
import type { Fetcher } from '../../types';

const ORIGIN = 'https://bigline.hk';
const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
/**
 * `/tour-group/<id>`: one tour (586 in the 2026-11-12 sitemap, ids of 4 to 6 digits, such as 9109 and
 * 624469; both kinds answer the same detail request). `/tour-group/cruise/<id>` is a route of the app that
 * the sitemap does not list; it was not examined.
 */
const TOUR_PATH = /^\/tour-group\/([1-9][0-9]{0,9})\/?$/;
/** A Big Line tour id: the only text that goes into a request URL or body. */
const TOUR_ID = /^[1-9][0-9]{0,9}$/;
/** `YYYY-MM`, a real month. */
const YEAR_MONTH = /^[0-9]{4}-(?:0[1-9]|1[0-2])$/;

/** The site's data host (docs/operators/bigline.md, "The API"). */
export const API_HOST = 'api.biglinehk.com';
const API = `https://${API_HOST}`;
/** The departures of one month, POSTed with `datesBody`. */
export const DATES_URL = `${API}/bigline/global/product/release/page`;

/** The page's id, or null if it is not a single-tour page on https://bigline.hk. */
export function tourIdOf(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== ORIGIN) return null;
  return TOUR_PATH.exec(parsed.pathname)?.[1] ?? null;
}

/** True for a single-tour page on https://bigline.hk. */
export function isTourUrl(url: string): boolean {
  return tourIdOf(url) !== null;
}

/** Every tour page in the sitemap (an index with one child), as the public page URL, each once. */
export async function discover(fetcher: Fetcher): Promise<string[]> {
  const urls = await readSitemapUrls(fetcher, SITEMAP_URL);
  const tours = new Set<string>();
  for (const url of urls) {
    const id = tourIdOf(url);
    if (id !== null) tours.add(`${ORIGIN}/tour-group/${id}`);
  }
  return [...tours];
}

function checkedId(id: string): string {
  if (!TOUR_ID.test(id)) throw new Error(`not a Big Line tour id: ${JSON.stringify(id)}`);
  return id;
}

/** The tour's detail (title, code, days, day routes, gathering place, months with departures). */
export function detailUrl(id: string): string {
  return `${API}/bigline/global/product/tour/frontend/detail?id=${checkedId(id)}`;
}

/**
 * The JSON body the site's own tour page POSTs to DATES_URL for one month: `productId` is the id as a
 * string, `pageSize` 1000 (all of the month's departures on one page). Throws for an id that is not
 * digits or a month that is not `YYYY-MM`.
 */
export function datesBody(id: string, yearMonth: string): { pageNo: 1; productId: string; yearMonth: string; pageSize: 1000 } {
  if (!YEAR_MONTH.test(yearMonth)) throw new Error(`not a month (YYYY-MM): ${JSON.stringify(yearMonth)}`);
  return { pageNo: 1, productId: checkedId(id), yearMonth, pageSize: 1000 };
}
