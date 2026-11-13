import { expect, it } from 'vitest';
import type { Fetcher } from '../../types';
import { discover, isTourUrl } from './discover';

const SITEMAP = 'https://www.texpert.com/sitemap/sitemap_tour_zh-hk.xml';

// Real URLs from https://www.texpert.com/sitemap/sitemap_tour_zh-hk.xml (docs/operators/texpert.md). That sitemap
// lists only tour pages as <loc>; its non-tour URLs are the English alternates in <xhtml:link>, used as `false` here,
// with other pages named in the findings and off-site variants.
it.each([
  ['https://www.texpert.com/zh-hk/tour/1272-5-day-hengyang-changsha-zhangjiajie-fenghuang-ancient-city', true],
  ['https://www.texpert.com/zh-hk/tour/1386-guangdong-tour-2-day-pure-play-with-special-natural-sea-hot', true],
  ['https://www.texpert.com/zh-hk/tour/1359-guangdong-province-tour-1-day-new-huanggang-experience', true],
  ['https://www.texpert.com/zh-hk/tour/1391-8-day-high-speed-rail-pure-play-tour-wuhan-wudang-mountain', true],
  ['https://www.texpert.com/zh-hk/tour/1100-5-day-kuala-lumpur-port-dickson-malacca-sky-mirror-cultural', true],
  ['https://www.texpert.com/zh-hk/tour/1272-5-day-hengyang-changsha-zhangjiajie-fenghuang-ancient-city?ref=x', true],
  ['https://www.texpert.com/en/tour/1272-5-day-hengyang-changsha-zhangjiajie-fenghuang-ancient-city', false],
  ['https://www.texpert.com/en/tour/1391-8-day-high-speed-rail-pure-play-tour-wuhan-wudang-mountain', false],
  ['https://www.texpert.com/en/tour/1100-5-day-kuala-lumpur-port-dickson-malacca-sky-mirror-cultural', false],
  ['https://www.texpert.com/zh-hk/tour/list', false],
  ['https://www.texpert.com/zh-hk/terms', false],
  ['https://www.texpert.com/zh-hk', false],
  ['https://www.texpert.com/sitemap/sitemap_tour_zh-hk.xml', false],
  ['https://www.texpert.com/api/tour/1272', false],
  ['https://www.texpert.com/zh-hk/booking/1272', false],
  ['https://www.texpert.com/booking/1272-5-day-hengyang', false],
  ['https://www.texpert.com/zh-hk/checkout/1272', false],
  ['https://www.texpert.com/zh-hk/tour/1272-x/booking', false],
  ['http://www.texpert.com/zh-hk/tour/1272-5-day-hengyang-changsha-zhangjiajie-fenghuang-ancient-city', false],
  ['https://texpert.com/zh-hk/tour/1272-5-day-hengyang-changsha-zhangjiajie-fenghuang-ancient-city', false],
  ['https://www.texpert.com.example.test/zh-hk/tour/1272-5-day-hengyang', false],
  ['not a url', false],
])('isTourUrl(%s) is %s', (url, expected) => {
  expect(isTourUrl(url)).toBe(expected);
});

it('discover returns only the tour URLs from the sitemap, de-duplicated', async () => {
  const sitemap = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
  <urlset xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://www.texpert.com/zh-hk/tour/1391-8-day-high-speed-rail-pure-play-tour-wuhan-wudang-mountain</loc>
      <priority>0.8</priority>
      <xhtml:link rel="alternate" hreflang="zh-hk" href="https://www.texpert.com/zh-hk/tour/1391-8-day-high-speed-rail-pure-play-tour-wuhan-wudang-mountain" />
      <xhtml:link rel="alternate" hreflang="en" href="https://www.texpert.com/en/tour/1391-8-day-high-speed-rail-pure-play-tour-wuhan-wudang-mountain" />
    </url>
    <url><loc>https://www.texpert.com/en/tour/1100-5-day-kuala-lumpur-port-dickson-malacca-sky-mirror-cultural</loc></url>
    <url><loc>https://www.texpert.com/zh-hk/tour/1272-5-day-hengyang-changsha-zhangjiajie-fenghuang-ancient-city</loc></url>
    <url><loc>https://www.texpert.com/api/tour/1272</loc></url>
    <url><loc>https://www.texpert.com/zh-hk/booking/1272</loc></url>
    <url><loc>https://www.texpert.com/zh-hk/checkout/1272</loc></url>
    <url><loc>https://www.texpert.com/zh-hk/tour/list</loc></url>
    <url><loc>https://www.texpert.com/zh-hk/tour/1391-8-day-high-speed-rail-pure-play-tour-wuhan-wudang-mountain</loc></url>
    <url><loc>https://www.texpert.com/zh-hk/tour/1272-5-day-hengyang-changsha-zhangjiajie-fenghuang-ancient-city?utm_source=x</loc></url>
  </urlset>`;
  const asked: string[] = [];
  const fetcher: Fetcher = {
    fetchText: async url => {
      asked.push(url);
      return url === SITEMAP ? sitemap : null;
    },
  };
  expect(await discover(fetcher)).toEqual([
    'https://www.texpert.com/zh-hk/tour/1391-8-day-high-speed-rail-pure-play-tour-wuhan-wudang-mountain',
    'https://www.texpert.com/zh-hk/tour/1272-5-day-hengyang-changsha-zhangjiajie-fenghuang-ancient-city',
  ]);
  expect(asked).toEqual([SITEMAP]);
});

it('discover returns [] when the sitemap cannot be fetched', async () => {
  expect(await discover({ fetchText: async () => null })).toEqual([]);
});
