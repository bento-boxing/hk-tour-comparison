import { it, expect } from 'vitest';
import { parseSitemapXml, readSitemapUrls, sitemapDiscover } from './sitemap';
import type { Fetcher } from './types';

/** A Fetcher that serves fixed pages and records what was asked for. */
function fakeFetcher(pages: Record<string, string | null>): Fetcher & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    fetchText: async url => { asked.push(url); return pages[url] ?? null; },
  };
}

/** The invented site's hosts, and a log that keeps nothing. */
const HOSTS = ['x.test'];
const noLog = () => {};

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
  expect(await readSitemapUrls(fetcher, 'https://x.test/sitemap.xml', HOSTS, noLog))
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
  expect(await readSitemapUrls(fetcher, 'https://x.test/sitemap.xml', HOSTS, noLog)).toEqual(['https://x.test/tour/A']);
  expect(fetcher.asked).not.toContain('https://x.test/deeper.xml');
});

it('readSitemapUrls returns a plain urlset as is', async () => {
  const fetcher = fakeFetcher({ 'https://x.test/sitemap.xml': '<urlset><url><loc>https://x.test/tour/A</loc></url></urlset>' });
  expect(await readSitemapUrls(fetcher, 'https://x.test/sitemap.xml', HOSTS, noLog)).toEqual(['https://x.test/tour/A']);
});

it('readSitemapUrls returns [] when the sitemap is unavailable', async () => {
  const fetcher = fakeFetcher({});
  expect(await readSitemapUrls(fetcher, 'https://x.test/sitemap.xml', HOSTS, noLog)).toEqual([]);
  expect(fetcher.asked).toEqual(['https://x.test/sitemap.xml']);
});

it('readSitemapUrls requests a child sitemap only on the operator\'s hosts; the others are skipped and counted by host', async () => {
  const index = [
    'https://x.test/s1.xml',                   // allowed
    'https://www.x.test/s2.xml',               // the other form of the domain, allowed here
    'https://elsewhere.test/s3.xml?secret=1',  // another host
    'https://x.test.evil.test/s4.xml',         // a look-alike
    'https://evilx.test/s5.xml',               // a look-alike
    'https://169.254.169.254/s6.xml',          // an IP address
    'https://localhost/s7.xml',
    'http://x.test/s8.xml',                    // an allowed host over http
    'https://x.test:8443/s9.xml',              // an allowed host on another port
    '/s10.xml',                                // not an absolute address
    'https://elsewhere.test/s11.xml',          // the same host again: counted, named once
  ];
  const fetcher = fakeFetcher({
    'https://x.test/sitemap.xml': `<sitemapindex>${index.map(loc => `<sitemap><loc>${loc}</loc></sitemap>`).join('')}</sitemapindex>`,
    'https://x.test/s1.xml': '<urlset><url><loc>https://x.test/tour/A</loc></url></urlset>',
    'https://www.x.test/s2.xml': '<urlset><url><loc>https://x.test/tour/B</loc></url></urlset>',
  });
  const lines: string[] = [];
  expect(await readSitemapUrls(fetcher, 'https://x.test/sitemap.xml', ['x.test', 'www.x.test'], line => lines.push(line)))
    .toEqual(['https://x.test/tour/A', 'https://x.test/tour/B']);
  expect(fetcher.asked).toEqual(['https://x.test/sitemap.xml', 'https://x.test/s1.xml', 'https://www.x.test/s2.xml']);
  // 9 skipped on 8 distinct hosts: the first MAX_HOSTS_LOGGED (5) are named, then how many more.
  expect(lines).toEqual(['sitemap: skipped 9 child sitemaps not on the operator\'s hosts (elsewhere.test, x.test.evil.test, '
    + 'evilx.test, 169.254.169.254, localhost, +3 more)']);
});

it('readSitemapUrls names every host when there are at most five, and one child in the singular', async () => {
  const fetcher = fakeFetcher({
    'https://x.test/sitemap.xml': '<sitemapindex><sitemap><loc>https://elsewhere.test/s.xml</loc></sitemap></sitemapindex>',
  });
  const lines: string[] = [];
  await readSitemapUrls(fetcher, 'https://x.test/sitemap.xml', HOSTS, line => lines.push(line));
  expect(lines).toEqual(['sitemap: skipped 1 child sitemap not on the operator\'s hosts (elsewhere.test)']);
});

it('readSitemapUrls keeps the line short for an index of thousands of children on distinct hosts', async () => {
  const index = Array.from({ length: 3000 }, (_, i) => `<sitemap><loc>https://h${i}.elsewhere.test/s.xml</loc></sitemap>`).join('');
  const fetcher = fakeFetcher({ 'https://x.test/sitemap.xml': `<sitemapindex>${index}</sitemapindex>` });
  const lines: string[] = [];
  await readSitemapUrls(fetcher, 'https://x.test/sitemap.xml', HOSTS, line => lines.push(line));
  expect(fetcher.asked).toEqual(['https://x.test/sitemap.xml']);
  expect(lines).toEqual(['sitemap: skipped 3000 child sitemaps not on the operator\'s hosts '
    + '(h0.elsewhere.test, h1.elsewhere.test, h2.elsewhere.test, h3.elsewhere.test, h4.elsewhere.test, +2995 more)']);
});

it('readSitemapUrls logs nothing when every child sitemap is on the operator\'s hosts', async () => {
  const fetcher = fakeFetcher({
    'https://x.test/sitemap.xml': '<sitemapindex><sitemap><loc>https://x.test/s1.xml</loc></sitemap></sitemapindex>',
  });
  const lines: string[] = [];
  expect(await readSitemapUrls(fetcher, 'https://x.test/sitemap.xml', HOSTS, line => lines.push(line))).toEqual([]);
  expect(fetcher.asked).toEqual(['https://x.test/sitemap.xml', 'https://x.test/s1.xml']);
  expect(lines).toEqual([]);
});

it('readSitemapUrls needs the operator\'s hosts', async () => {
  await expect(readSitemapUrls(fakeFetcher({}), 'https://x.test/sitemap.xml', [], noLog)).rejects.toThrow('at least one host');
});

it('sitemapDiscover returns each address its rule accepts, as the rule gives it, once, in the sitemap\'s order', async () => {
  const fetcher = fakeFetcher({
    'https://x.test/sitemap.xml': '<sitemapindex><sitemap><loc>https://x.test/s1.xml</loc></sitemap>'
      + '<sitemap><loc>https://elsewhere.test/s2.xml</loc></sitemap></sitemapindex>',
    'https://x.test/s1.xml': '<urlset><url><loc>https://x.test/tour/B?x=1</loc></url><url><loc>https://x.test/about</loc></url>'
      + '<url><loc>https://x.test/tour/A</loc></url><url><loc>https://x.test/tour/B</loc></url></urlset>',
  });
  const lines: string[] = [];
  const discover = sitemapDiscover({
    sitemapUrl: 'https://x.test/sitemap.xml',
    allowedHosts: HOSTS,
    tourUrl: url => (url.startsWith('https://x.test/tour/') ? url.replace(/\?.*$/, '') : null),
  });
  expect(await discover(fetcher, undefined, line => lines.push(line))).toEqual(['https://x.test/tour/B', 'https://x.test/tour/A']);
  expect(fetcher.asked).toEqual(['https://x.test/sitemap.xml', 'https://x.test/s1.xml']);
  expect(lines).toEqual(['sitemap: skipped 1 child sitemap not on the operator\'s hosts (elsewhere.test)']);
  expect(await discover(fakeFetcher({}))).toEqual([]);
});
