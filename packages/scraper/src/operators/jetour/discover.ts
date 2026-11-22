import { readSitemapUrls } from '../../sitemap';
import type { LogView } from '../../public-log';
import type { Fetcher } from '../../types';

const ORIGIN = 'https://www.jetour.com.hk';
const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
/**
 * Every host a run may request (OperatorScraper.allowedHosts): the site, where the sitemap and the tour pages are
 * (docs/operators/jetour.md). The bare `jetour.com.hk` is never requested; it is allowed only in case the site one
 * night redirects to that form of its own domain (an assumption: no note shows either form redirecting).
 */
export const ALLOWED_HOSTS = ['www.jetour.com.hk', 'jetour.com.hk'] as const;
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

/** Every single-tour page in the sitemap, without query strings, each once. `log`: the run's (see readSitemapUrls). */
export async function discover(
  fetcher: Fetcher, _logView?: LogView, log?: (line: string) => void,
): Promise<string[]> {
  const urls = await readSitemapUrls(fetcher, SITEMAP_URL, ALLOWED_HOSTS, log);
  const tours = new Set<string>();
  for (const url of urls) {
    const tour = tourPageUrl(url);
    if (tour !== null) tours.add(tour);
  }
  return [...tours];
}
