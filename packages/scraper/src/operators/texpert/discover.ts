import { sitemapDiscover } from '../../sitemap';
import { urlOn } from '../shared/url';

const ORIGIN = 'https://www.texpert.com';
const SITEMAP_URL = `${ORIGIN}/sitemap/sitemap_tour_zh-hk.xml`;
/**
 * Every host a run may request (OperatorScraper.allowedHosts): the site, where the tour sitemap and the tour pages are
 * (docs/operators/texpert.md). The bare `texpert.com` is never requested; it is allowed only in case the site one
 * night redirects to that form of its own domain (an assumption: no note shows either form redirecting).
 */
export const ALLOWED_HOSTS = ['www.texpert.com', 'texpert.com'] as const;
/**
 * `/zh-hk/tour/<id>-<english-slug>`: one tour product, e.g. `1272-5-day-hengyang-changsha-…`.
 * `/zh-hk/tour/list` is the search page; `/en/` pages are the English copies and are never fetched.
 * Nothing under `/api/`, `/booking/` or `/checkout/` can match (robots.txt disallows them).
 */
const TOUR_PATH = /^\/zh-hk\/tour\/(\d+(?:-[A-Za-z0-9]+)*)\/?$/;

/** The page's URL as `https://www.texpert.com/zh-hk/tour/<id>-<slug>`, or null if it is not a single-tour page. */
function tourPageUrl(url: string): string | null {
  const parsed = urlOn(url, ORIGIN);
  if (parsed === null) return null;
  const match = TOUR_PATH.exec(parsed.pathname);
  return match ? `${ORIGIN}/zh-hk/tour/${match[1]}` : null;
}

/** True for a single-tour page in Traditional Chinese on https://www.texpert.com. */
export function isTourUrl(url: string): boolean {
  return tourPageUrl(url) !== null;
}

/** Every single-tour page in the tour sitemap, without query strings, each once. `log`: the run's (see readSitemapUrls). */
export const discover = sitemapDiscover({ sitemapUrl: SITEMAP_URL, allowedHosts: ALLOWED_HOSTS, tourUrl: tourPageUrl });
