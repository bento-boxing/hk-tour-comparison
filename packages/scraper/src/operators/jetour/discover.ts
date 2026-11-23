import { sitemapDiscover } from '../../sitemap';
import { urlOn } from '../shared/url';

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
  const parsed = urlOn(url, ORIGIN);
  if (parsed === null) return null;
  const match = TOUR_PATH.exec(parsed.pathname);
  if (!match || match[1].toLowerCase() === 'dest') return null;
  return `${ORIGIN}/tour/${match[1]}`;
}

/** True for a single-tour page on https://www.jetour.com.hk. */
export function isTourUrl(url: string): boolean {
  return tourPageUrl(url) !== null;
}

/** Every single-tour page in the sitemap, without query strings, each once. `log`: the run's (see readSitemapUrls). */
export const discover = sitemapDiscover({ sitemapUrl: SITEMAP_URL, allowedHosts: ALLOWED_HOSTS, tourUrl: tourPageUrl });
