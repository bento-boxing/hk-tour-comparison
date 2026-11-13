import { expect, it } from 'vitest';
import type { Fetcher } from '../../types';
import { discover, isTourUrl } from './discover';

// Real URLs from https://www.jetour.com.hk/sitemap.xml (docs/operators/jetour.md), plus off-site variants.
it.each([
  ['https://www.jetour.com.hk/tour/THB', true],
  ['https://www.jetour.com.hk/tour/TSEQ', true],
  ['https://www.jetour.com.hk/tour/HKWA-HKWAJ', true],
  ['https://www.jetour.com.hk/tour/EIMz', true],
  ['https://www.jetour.com.hk/tour/TUNB-1', true],
  ['https://www.jetour.com.hk/tour/dest/china', false],
  ['https://www.jetour.com.hk/tour/dest/china/northeast', false],
  ['https://www.jetour.com.hk/cruise-tour/CMMG', false],
  ['https://www.jetour.com.hk/cruise/CZZMEDNC_26346_JJ', false],
  ['https://www.jetour.com.hk/seminar/HTE_sem20260927a', false],
  ['https://www.jetour.com.hk/tour/江門,新會,珠海美食純玩之旅', false], // the empty page with no code
  ['https://www.jetour.com.hk/tour/dest', false],
  ['http://www.jetour.com.hk/tour/THB', false],
  ['https://jetour.com.hk/tour/THB', false],
  ['https://www.jetour.com.hk.example.test/tour/THB', false],
  ['not a url', false],
])('isTourUrl(%s) is %s', (url, expected) => {
  expect(isTourUrl(url)).toBe(expected);
});

it('discover returns only the tour URLs from the sitemap, de-duplicated', async () => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8" ?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://www.jetour.com.hk/tour/THB</loc></url>
    <url><loc>https://www.jetour.com.hk/tour/dest/china</loc></url>
    <url><loc>https://www.jetour.com.hk/tour/TSEQ</loc></url>
    <url><loc>https://www.jetour.com.hk/cruise-tour/CMMG</loc></url>
    <url><loc>https://www.jetour.com.hk/tour/THB</loc></url>
    <url><loc>https://www.jetour.com.hk/tour/TSEQ?ref=sitemap</loc></url>
    <url><loc>https://www.jetour.com.hk/tour/江門,新會,珠海美食純玩之旅</loc></url>
    <url><loc>https://www.jetour.com.hk/seminar/HTE_sem20260927a</loc></url>
  </urlset>`;
  const asked: string[] = [];
  const fetcher: Fetcher = {
    fetchText: async url => {
      asked.push(url);
      return url === 'https://www.jetour.com.hk/sitemap.xml' ? sitemap : null;
    },
  };
  expect(await discover(fetcher)).toEqual(['https://www.jetour.com.hk/tour/THB', 'https://www.jetour.com.hk/tour/TSEQ']);
  expect(asked).toEqual(['https://www.jetour.com.hk/sitemap.xml']);
});

it('discover returns [] when the sitemap cannot be fetched', async () => {
  expect(await discover({ fetchText: async () => null })).toEqual([]);
});
