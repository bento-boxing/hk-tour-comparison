import { allowedOriginsOf, offAllowedHosts } from './polite-fetch';
import type { Fetcher, OperatorScraper } from './types';

/** `<url>…</url>` and `<sitemap>…</sitemap>` entries; `\b` keeps `<urlset>` and `<sitemapindex>` out. */
const ENTRY = /<(url|sitemap)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
/** The entry's own `<loc>`, not a namespaced one such as `<image:loc>`. */
const LOC = /<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/i;
const CDATA = /^<!\[CDATA\[([\s\S]*?)\]\]>$/;
const ENTITY = /&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi;
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text: string): string {
  return text.replace(ENTITY, (whole, name: string) => {
    if (name[0] !== '#') return NAMED_ENTITIES[name.toLowerCase()];
    const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

function locText(raw: string): string {
  const trimmed = raw.trim();
  const cdata = CDATA.exec(trimmed);
  return (cdata ? cdata[1] : decodeEntities(trimmed)).trim();
}

/** Page URLs and child sitemap URLs listed in one sitemap file. Junk gives empty lists. */
export function parseSitemapXml(xml: string): { urls: string[]; sitemaps: string[] } {
  const urls: string[] = [];
  const sitemaps: string[] = [];
  for (const [, tag, body] of xml.matchAll(ENTRY)) {
    const loc = LOC.exec(body);
    if (!loc) continue;
    const value = locText(loc[1]);
    if (value === '') continue;
    (tag.toLowerCase() === 'url' ? urls : sitemaps).push(value);
  }
  return { urls, sitemaps };
}

/** The skipped-children line names at most this many hosts, then how many more there were. */
export const MAX_HOSTS_LOGGED = 5;

/** The child's address as a URL, or null when it is not an absolute address. */
function absoluteUrl(text: string): URL | null {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

/**
 * Follows a sitemap index one level deep. Returns [] if the sitemap cannot be fetched. A child sitemap is requested
 * only when it is on the operator's `allowedHosts` (https on the default port, as the fetcher allows them; see
 * FetcherOptions.allowedHosts): the others are skipped, and counted in one line on `log` (the run's log, which the
 * runner passes through discover; unset: console.log) naming only their hosts, at most MAX_HOSTS_LOGGED of them.
 */
export async function readSitemapUrls(
  fetcher: Fetcher, sitemapUrl: string, allowedHosts: readonly string[], log: (line: string) => void = line => console.log(line),
): Promise<string[]> {
  const allowed = allowedOriginsOf(allowedHosts);
  const xml = await fetcher.fetchText(sitemapUrl);
  if (xml === null) return [];
  const { urls, sitemaps } = parseSitemapXml(xml);
  const found = new Set(urls);
  const skippedHosts = new Set<string>();
  let skipped = 0;
  for (const child of sitemaps) {
    const childUrl = absoluteUrl(child);
    const offHosts = childUrl === null ? 'an address that is not absolute' : offAllowedHosts(childUrl, allowed);
    if (offHosts !== null) {
      skipped++;
      skippedHosts.add(offHosts);
      continue;
    }
    const childXml = await fetcher.fetchText(child);
    if (childXml === null) continue;
    for (const url of parseSitemapXml(childXml).urls) found.add(url);
  }
  if (skipped > 0) {
    const hosts = [...skippedHosts];
    const more = hosts.length > MAX_HOSTS_LOGGED ? `, +${hosts.length - MAX_HOSTS_LOGGED} more` : '';
    log(`sitemap: skipped ${skipped} child ${skipped === 1 ? 'sitemap' : 'sitemaps'} not on the operator's hosts `
      + `(${hosts.slice(0, MAX_HOSTS_LOGGED).join(', ')}${more})`);
  }
  return [...found];
}

/** What sitemapDiscover reads: one operator's sitemap, hosts and tour page rule. */
export interface SitemapDiscoverOptions {
  /** The sitemap, or sitemap index, listing the tour pages. */
  sitemapUrl: string;
  /** The operator's allowed hosts (OperatorScraper.allowedHosts): child sitemaps are read only on them. */
  allowedHosts: readonly string[];
  /** A listed address as the tour page URL to fetch, or null when it is not a tour page. */
  tourUrl: (url: string) => string | null;
}

/**
 * An operator's `discover` that reads its sitemap (readSitemapUrls, `log` being the run's) and returns every listed
 * address `tourUrl` accepts, as `tourUrl` gives it, each once, in the sitemap's order. For the operators whose tours are
 * all in a sitemap (EGL, Jetour, Travel Expert, Big Line).
 */
export function sitemapDiscover(opts: SitemapDiscoverOptions): OperatorScraper['discover'] {
  return async (fetcher, _logView, log) => {
    const urls = await readSitemapUrls(fetcher, opts.sitemapUrl, opts.allowedHosts, log);
    const tours = new Set<string>();
    for (const url of urls) {
      const tour = opts.tourUrl(url);
      if (tour !== null) tours.add(tour);
    }
    return [...tours];
  };
}
