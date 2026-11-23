import type { Fetcher } from '../../types';
import { isCount } from '../shared/json';
import { publicListing } from './public';

/**
 * The site's data host (docs/operators/yummy.md, "Where each fact comes from"). Only three paths on it are ever
 * requested, all by GET with no extra headers: LISTING_URL once a night, then detailUrl and datesUrl per tour.
 * Never a staff endpoint, a POST, an image or a PDF.
 */
const API = 'https://api.yummyholiday.net';
/**
 * Every tour, on one page: 327 rows on 2026-11-14. If the listing ever needs a second page, discovery fails
 * rather than reading part of it (see discover).
 */
export const LISTING_URL = `${API}/bussiness/line/index?limit=500`;

const SITE = 'https://www.yummyholiday.net';
/**
 * Every host a run may request (OperatorScraper.allowedHosts): the API host, the only one requested (the listing, then
 * each tour's detail and dates), and the site's own host, which is never requested (its tour pages are only links)
 * and is allowed only in case the API one night redirects there. Not the image host `img.yummyholiday.net`: no
 * request of the module goes there (docs/operators/yummy.md, "Where each fact comes from").
 */
export const ALLOWED_HOSTS = ['api.yummyholiday.net', 'www.yummyholiday.net'] as const;
/** A Yummy Holiday tour id: the only text that goes into a request URL. */
const TOUR_ID = /^[1-9][0-9]{0,9}$/;
/** The site's tour page, a hash route of its single-page app: `/#/pages/detail/detail?id=<id>`, exactly. */
const TOUR_PAGE = /^https:\/\/www\.yummyholiday\.net\/#\/pages\/detail\/detail\?id=([1-9][0-9]{0,9})$/;

function checkedId(id: string): string {
  if (!TOUR_ID.test(id)) throw new Error(`not a Yummy Holiday tour id (${id.length} characters)`);
  return id;
}

/** The tour's detail: code, titles, days, "from" price and city list (`dist_list`). */
export function detailUrl(id: string): string {
  return `${API}/bussiness/line/detail?id=${checkedId(id)}`;
}

/** The tour's groups: every departure date with its status and price, cancelled ones included. */
export function datesUrl(id: string): string {
  return `${API}/bussiness/group/list?line_id=${checkedId(id)}`;
}

/** The site's own page for the tour: the "view on the operator's site" link, and the tour's identity in a run. */
export function tourPageUrl(id: string): string {
  return `${SITE}/#/pages/detail/detail?id=${checkedId(id)}`;
}

/** The tour id of a tour page URL as tourPageUrl writes it, or null for any other URL. */
export function tourIdOf(url: string): string | null {
  return TOUR_PAGE.exec(url)?.[1] ?? null;
}

/** True for a tour page as tourPageUrl writes it. */
export function isTourUrl(url: string): boolean {
  return tourIdOf(url) !== null;
}

/**
 * Every tour the listing holds, as its tour page, each once, in the listing's order. One request. Discovery
 * throws (the run then fails as `discover-error` and last night's tours stay) unless the listing answers code 1
 * with a list of rows, says it is on one page (`last_page` 1), holds exactly as many rows as its `total`, and
 * gives every row a tour id: a listing read in part would deactivate the tours it left out. The reasons are
 * fixed texts and numbers, never the answer's own text.
 */
export async function discover(fetcher: Fetcher): Promise<string[]> {
  const text = await fetcher.fetchText(LISTING_URL);
  if (text === null) throw new Error('yummy: the listing was not fetched');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('yummy: the listing is not JSON');
  }
  const listing = publicListing(json);
  if (listing.code !== 1) {
    throw new Error(`yummy: the listing answered code ${isCount(listing.code) ? listing.code : 'none'}`);
  }
  if (listing.data === null) throw new Error('yummy: the listing has no list of tours');
  const { total, last_page: lastPage, rows } = listing.data;
  if (lastPage !== 1) {
    throw new Error(`yummy: the listing has ${isCount(lastPage) ? lastPage : 'an unknown number of'} pages; only one is read`);
  }
  if (!isCount(total)) throw new Error('yummy: the listing gives no tour count');
  if (rows.length !== total) throw new Error(`yummy: the listing holds ${rows.length} rows, but says it has ${total}`);

  const tours = new Set<string>();
  for (const row of rows) {
    const id = isCount(row.id) && row.id > 0 ? String(row.id) : '';
    if (!TOUR_ID.test(id)) throw new Error('yummy: the listing has a row without a tour id');
    tours.add(tourPageUrl(id));
  }
  return [...tours];
}
