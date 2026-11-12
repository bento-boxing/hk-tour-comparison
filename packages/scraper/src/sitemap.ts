import type { Fetcher } from './types';

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

/** Follows a sitemap index one level deep. Returns [] if the sitemap cannot be fetched. */
export async function readSitemapUrls(fetcher: Fetcher, sitemapUrl: string): Promise<string[]> {
  const xml = await fetcher.fetchText(sitemapUrl);
  if (xml === null) return [];
  const { urls, sitemaps } = parseSitemapXml(xml);
  const found = new Set(urls);
  for (const child of sitemaps) {
    const childXml = await fetcher.fetchText(child);
    if (childXml === null) continue;
    for (const url of parseSitemapXml(childXml).urls) found.add(url);
  }
  return [...found];
}
