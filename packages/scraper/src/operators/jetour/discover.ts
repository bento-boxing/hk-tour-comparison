import { readSitemapUrls } from '../../sitemap';
import type { Fetcher } from '../../types';

const ORIGIN = 'https://www.jetour.com.hk';
const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
/**
 * `/tour/<CODE>`: one tour product. Codes are letters and digits, optionally hyphenated
 * (`THB`, `EIMz`, `HKWA-HKWAJ`, `TUNB-1`). `/tour/dest/…` pages are destination lists.
 */
const TOUR_PATH = /^\/tour\/([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\/?$/;

/** The page's URL as `https://www.jetour.com.hk/tour/<CODE>`, or null if it is not a single-tour page. */
function tourPageUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== ORIGIN) return null;
  const match = TOUR_PATH.exec(parsed.pathname);
  if (!match || match[1].toLowerCase() === 'dest') return null;
  return `${ORIGIN}/tour/${match[1]}`;
}

/** True for a single-tour page on https://www.jetour.com.hk. */
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
