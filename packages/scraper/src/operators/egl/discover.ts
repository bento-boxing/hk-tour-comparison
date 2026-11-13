import { TOUR_CODE_PATTERN } from '@hktours/core';
import { readSitemapUrls } from '../../sitemap';
import type { Fetcher } from '../../types';

const ORIGIN = 'https://www.egltours.com';
const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
/**
 * `/website/itinerary/<CODE>`: one tour (573 in the 2026-11-12 sitemap, codes such as `HTJSJG06`).
 * `/website/itinerary-premier/…` and `/website/itinerary-hii-fly/…` (3 pages) use other templates, not examined.
 */
const TOUR_PATH = /^\/website\/itinerary\/([A-Za-z0-9]+)\/?$/;
/** The site's own script sends `/website/itinerary/hc…` (any case) to `/website/cruise`: not a tour page. */
const CRUISE_CODE = /^hc/i;

/** The page's URL as `https://www.egltours.com/website/itinerary/<CODE>`, or null if it is not a single-tour page. */
function tourPageUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== ORIGIN) return null;
  const code = TOUR_PATH.exec(parsed.pathname)?.[1];
  if (code === undefined || !TOUR_CODE_PATTERN.test(code) || CRUISE_CODE.test(code)) return null;
  return `${ORIGIN}/website/itinerary/${code}`;
}

/** True for a single-tour page on https://www.egltours.com. */
export function isTourUrl(url: string): boolean {
  return tourPageUrl(url) !== null;
}

/** Every single-tour page in the sitemap, without query strings, each once. */
export async function discover(fetcher: Fetcher): Promise<string[]> {
  const urls = await readSitemapUrls(fetcher, SITEMAP_URL);
  const tours = new Set<string>();
  for (const url of urls) {
    const tour = tourPageUrl(url);
    if (tour !== null) tours.add(tour);
  }
  return [...tours];
}

/**
 * The tour's departure dates and prices, as JSON (the request the page's own calendar makes; robots.txt
 * allows `/api/`). Throws for a `code` that does not match TOUR_CODE_PATTERN, so no code can change the path.
 */
export function datesUrl(code: string): string {
  if (!TOUR_CODE_PATTERN.test(code)) throw new Error(`not a tour code: ${JSON.stringify(code)}`);
  return `${ORIGIN}/api/v1/tours/${code}/dates?currencyCode=HKD`;
}
