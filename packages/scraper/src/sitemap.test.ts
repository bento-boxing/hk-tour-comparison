import { it, expect } from 'vitest';
import { parseSitemapXml, readSitemapUrls } from './sitemap';
import type { Fetcher } from './types';

/** A Fetcher that serves fixed pages and records what was asked for. */
function fakeFetcher(pages: Record<string, string | null>): Fetcher & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    fetchText: async url => { asked.push(url); return pages[url] ?? null; },
  };
}

it('parses a urlset', () => {
  expect(parseSitemapXml('<urlset><url><loc>https://x.test/tour/A</loc></url><url><loc> https://x.test/tour/B </loc></url></urlset>'))
    .toEqual({ urls: ['https://x.test/tour/A', 'https://x.test/tour/B'], sitemaps: [] });
});

it('parses a sitemap index', () => {
  expect(parseSitemapXml('<sitemapindex><sitemap><loc>https://x.test/s1.xml</loc></sitemap></sitemapindex>'))
    .toEqual({ urls: [], sitemaps: ['https://x.test/s1.xml'] });
});

it('decodes &amp; in URLs and survives junk', () => {
  expect(parseSitemapXml('<urlset><url><loc>https://x.test/a?b=1&amp;c=2</loc></url></urlset>').urls).toEqual(['https://x.test/a?b=1&c=2']);
  expect(parseSitemapXml('not xml')).toEqual({ urls: [], sitemaps: [] });
});

it('reads a real-world sitemap: declaration, namespaces, CDATA, image tags, newlines', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>
      https://x.test/tour/A
    </loc>
    <lastmod>2026-11-01</lastmod>
    <image:image><image:loc>https://x.test/img/a.jpg</image:loc></image:image>
  </url>
  <url><loc><![CDATA[https://x.test/tour/B?x=1&y=2]]></loc></url>
  <url><lastmod>2026-11-01</lastmod></url>
</urlset>`;
  expect(parseSitemapXml(xml)).toEqual({ urls: ['https://x.test/tour/A', 'https://x.test/tour/B?x=1&y=2'], sitemaps: [] });
});

it('readSitemapUrls follows an index one level', async () => {
  const fetcher = fakeFetcher({
    'https://x.test/sitemap.xml':
      '<sitemapindex><sitemap><loc>https://x.test/s1.xml</loc></sitemap><sitemap><loc>https://x.test/s2.xml</loc></sitemap></sitemapindex>',
    'https://x.test/s1.xml': '<urlset><url><loc>https://x.test/tour/A</loc></url><url><loc>https://x.test/tour/B</loc></url></urlset>',
    'https://x.test/s2.xml': '<urlset><url><loc>https://x.test/tour/B</loc></url><url><loc>https://x.test/tour/C</loc></url></urlset>',
  });
  expect(await readSitemapUrls(fetcher, 'https://x.test/sitemap.xml'))
    .toEqual(['https://x.test/tour/A', 'https://x.test/tour/B', 'https://x.test/tour/C']);
  expect(fetcher.asked).toEqual(['https://x.test/sitemap.xml', 'https://x.test/s1.xml', 'https://x.test/s2.xml']);
});

it('readSitemapUrls goes only one level deep and skips a child sitemap it cannot get', async () => {
  const fetcher = fakeFetcher({
    'https://x.test/sitemap.xml':
      '<sitemapindex><sitemap><loc>https://x.test/s1.xml</loc></sitemap><sitemap><loc>https://x.test/gone.xml</loc></sitemap></sitemapindex>',
    'https://x.test/s1.xml':
      '<sitemapindex><sitemap><loc>https://x.test/deeper.xml</loc></sitemap></sitemapindex><urlset><url><loc>https://x.test/tour/A</loc></url></urlset>',
    'https://x.test/deeper.xml': '<urlset><url><loc>https://x.test/tour/Z</loc></url></urlset>',
  });
  expect(await readSitemapUrls(fetcher, 'https://x.test/sitemap.xml')).toEqual(['https://x.test/tour/A']);
  expect(fetcher.asked).not.toContain('https://x.test/deeper.xml');
});

it('readSitemapUrls returns a plain urlset as is', async () => {
  const fetcher = fakeFetcher({ 'https://x.test/sitemap.xml': '<urlset><url><loc>https://x.test/tour/A</loc></url></urlset>' });
  expect(await readSitemapUrls(fetcher, 'https://x.test/sitemap.xml')).toEqual(['https://x.test/tour/A']);
});

it('readSitemapUrls returns [] when the sitemap is unavailable', async () => {
  const fetcher = fakeFetcher({});
  expect(await readSitemapUrls(fetcher, 'https://x.test/sitemap.xml')).toEqual([]);
  expect(fetcher.asked).toEqual(['https://x.test/sitemap.xml']);
});
