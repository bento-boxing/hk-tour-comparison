import { readSitemapUrls } from '../../sitemap';
import type { Fetcher } from '../../types';

const ORIGIN = 'https://www.texpert.com';
const SITEMAP_URL = `${ORIGIN}/sitemap/sitemap_tour_zh-hk.xml`;
/**
 * `/zh-hk/tour/<id>-<english-slug>`: one tour product, e.g. `1272-5-day-hengyang-changsha-…`.
 * `/zh-hk/tour/list` is the search page; `/en/` pages are the English copies and are never fetched.
 * Nothing under `/api/`, `/booking/` or `/checkout/` can match (robots.txt disallows them).
 */
const TOUR_PATH = /^\/zh-hk\/tour\/(\d+(?:-[A-Za-z0-9]+)*)\/?$/;

/** The page's URL as `https://www.texpert.com/zh-hk/tour/<id>-<slug>`, or null if it is not a single-tour page. */
function tourPageUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== ORIGIN) return null;
  const match = TOUR_PATH.exec(parsed.pathname);
  return match ? `${ORIGIN}/zh-hk/tour/${match[1]}` : null;
}

/** True for a single-tour page in Traditional Chinese on https://www.texpert.com. */
export function isTourUrl(url: string): boolean {
  return tourPageUrl(url) !== null;
}

/** Every single-tour page in the tour sitemap, without query strings, each once. */
export async function discover(fetcher: Fetcher): Promise<string[]> {
  const urls = await readSitemapUrls(fetcher, SITEMAP_URL);
  const tours = new Set<string>();
  for (const url of urls) {
    const tour = tourPageUrl(url);
    if (tour !== null) tours.add(tour);
  }
  return [...tours];
}
