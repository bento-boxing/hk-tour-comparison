import type { Fetcher } from '../../types';
import { publicEntry, type PublicEntry } from './public';

/**
 * The only two paths ever requested on the site (docs/operators/sunflower.md), both by plain GET with no extra
 * headers, always in the `https://` form: LISTING_URL once a night, then each tour's bookingUrl once. Never a
 * `?date=` booking step, a `/tourpdf/` itinerary (robots.txt disallows it), a `__doPostBack` POST for another
 * month, or `CheckUpdate.ashx` (owner decision 2026-11-14: a reduced listing).
 */
const SITE = 'https://www.sunflower.com.hk';
/** Every listing entry of every region in one answer (616 entries on 2026-11-14, 370 of them with a booking code). */
export const LISTING_URL = `${SITE}/App/Tour/Get?Region=&Area=&Subarea=&keyword=`;

/**
 * Every request: a redirect is followed only within https://www.sunflower.com.hk; one that leaves it (to `http://`,
 * as the investigation saw for `/OnlineBooking?TourCode=…` without the slash) is not requested, and the page counts
 * as not fetched.
 */
export const SAME_SITE = { sameOriginRedirectsOnly: true } as const;

/** A tour code (`ItinCode`, `KKFE05WR`, `LWZA05X1`): the only text that goes into a request URL. */
const CODE = /^[A-Za-z0-9]{1,40}$/;
/** The booking page as bookingUrl writes it, exactly. */
const BOOKING_PAGE = /^https:\/\/www\.sunflower\.com\.hk\/OnlineBooking\/\?TourCode=([A-Za-z0-9]{1,40})$/;

/**
 * The tour's booking page: its dates for one calendar month, and its days tag. It is also the tour's identity in
 * a run and the "view on the operator's site" link.
 */
export function bookingUrl(code: string): string {
  if (!CODE.test(code)) throw new Error(`not a Sunflower tour code (${code.length} characters)`);
  return `${SITE}/OnlineBooking/?TourCode=${code}`;
}

/** The tour code of a booking page as bookingUrl writes it, or null for any other URL. */
export function codeOf(url: string): string | null {
  return BOOKING_PAGE.exec(url)?.[1] ?? null;
}

export function isTourUrl(url: string): boolean {
  return codeOf(url) !== null;
}

export interface Listing {
  /** The entries with an online booking code, each code once (the first entry wins), in the listing's order. */
  tours: PublicEntry[];
  /** Entries without a booking code (cruises, private groups, day trips…), by region, most first. */
  leftOut: [region: string, count: number][];
  /** Codes that appeared on more than one entry. */
  repeated: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The listing's tours, or an error with a fixed text (never the answer's own): discovery then fails as
 * `discover-error` and last night's tours stay. An entry with an empty `ItinCode` has no online booking and is
 * not a tour for us; a booking code that is not plain letters and digits fails the whole listing, since it would
 * have to go into a request URL.
 */
export function readListing(text: string): Listing {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('sunflower: the listing is not JSON');
  }
  if (!isObject(json) || json.status !== true) throw new Error('sunflower: the listing did not answer status true');
  if (!Array.isArray(json.data)) throw new Error('sunflower: the listing has no list of entries');

  const tours = new Map<string, PublicEntry>();
  const leftOut = new Map<string, number>();
  const repeated = new Set<string>();
  for (const row of json.data) {
    const entry = publicEntry(row);
    if (entry.ItinCode === '') {
      const region = entry.region === '' ? '(no region)' : entry.region;
      leftOut.set(region, (leftOut.get(region) ?? 0) + 1);
      continue;
    }
    if (!CODE.test(entry.ItinCode)) throw new Error('sunflower: the listing has a booking code that is not plain letters and digits');
    if (tours.has(entry.ItinCode)) repeated.add(entry.ItinCode);
    else tours.set(entry.ItinCode, entry);
  }
  if (tours.size === 0) throw new Error('sunflower: the listing has no entry with an online booking code');
  return {
    tours: [...tours.values()],
    leftOut: [...leftOut].sort(([a, m], [b, n]) => n - m || (a < b ? -1 : a > b ? 1 : 0)),
    repeated: [...repeated],
  };
}

/** One request: the listing, read by readListing. What was left out is logged. */
export async function discoverTours(fetcher: Fetcher, log: (line: string) => void): Promise<PublicEntry[]> {
  const text = await fetcher.fetchText(LISTING_URL, SAME_SITE);
  if (text === null) throw new Error('sunflower: the listing was not fetched');
  const listing = readListing(text);
  const count = listing.leftOut.reduce((sum, [, n]) => sum + n, 0);
  if (count > 0) {
    const regions = listing.leftOut.map(([region, n]) => `${region} ${n}`).join(', ');
    log(`sunflower: left out ${count} listing ${count === 1 ? 'entry' : 'entries'} without an online booking code (${regions})`);
  }
  for (const code of listing.repeated) log(`sunflower: booking code ${code} is on more than one listing entry; the first is kept`);
  return listing.tours;
}
