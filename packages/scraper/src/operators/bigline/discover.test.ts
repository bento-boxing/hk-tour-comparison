import { expect, it } from 'vitest';
import type { Fetcher } from '../../types';
import { DATES_URL, datesBody, detailUrl, discover, isTourUrl, tourIdOf } from './discover';

// Real URLs from https://bigline.hk/sitemap-1.xml (docs/operators/bigline.md), plus off-site variants.
it.each([
  ['https://bigline.hk/tour-group/9109', true],
  ['https://bigline.hk/tour-group/8923', true],
  ['https://bigline.hk/tour-group/22042', true],
  ['https://bigline.hk/tour-group/624469', true],
  ['https://bigline.hk/tour-group/624469/', true],
  ['https://bigline.hk/', false],
  ['https://bigline.hk/charter', false],
  ['https://bigline.hk/support/faq', false],
  ['https://bigline.hk/free-travel/package/92', false],
  ['https://bigline.hk/tour-group/cruise/12', false], // a route in the app, not in the sitemap and not examined
  ['https://bigline.hk/tour-group/', false],
  ['https://bigline.hk/tour-group/9109abc', false],
  ['https://bigline.hk/tour-group/%39109', false],
  ['https://bigline.hk/tour-group/0', false],
  ['https://bigline.hk/tour-group/12345678901', false], // more digits than any id seen
  ['http://bigline.hk/tour-group/9109', false],
  ['https://www.bigline.hk/tour-group/9109', false],
  ['https://h5.bigline.hk/tour-group/9109', false],
  ['https://bigline.hk.example.test/tour-group/9109', false],
  ['https://api.biglinehk.com/bigline/global/product/tour/frontend/detail?id=9109', false],
  ['not a url', false],
])('isTourUrl(%s) is %s', (url, expected) => {
  expect(isTourUrl(url)).toBe(expected);
});

it('tourIdOf reads the id of a tour page, ignoring a query string or fragment, and is null otherwise', () => {
  expect(tourIdOf('https://bigline.hk/tour-group/9109')).toBe('9109');
  expect(tourIdOf('https://bigline.hk/tour-group/9109?from=x#dates')).toBe('9109');
  expect(tourIdOf('https://bigline.hk/free-travel/package/92')).toBeNull();
});

it('discover returns only the tour pages from the sitemap index, de-duplicated, without query strings', async () => {
  const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://bigline.hk/sitemap-1.xml</loc></sitemap></sitemapindex>`;
  const child = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://bigline.hk/</loc></url>
<url><loc>https://bigline.hk/tour-group/9109</loc></url>
<url><loc>https://bigline.hk/free-travel/package/92</loc></url>
<url><loc>https://bigline.hk/tour-group/624469</loc></url>
<url><loc>https://bigline.hk/tour-group/9109?ref=sitemap</loc></url>
<url><loc>https://bigline.hk/travel-note/12</loc></url>
</urlset>`;
  const asked: string[] = [];
  const fetcher: Fetcher = {
    fetchText: async url => {
      asked.push(url);
      return url === 'https://bigline.hk/sitemap.xml' ? index : url === 'https://bigline.hk/sitemap-1.xml' ? child : null;
    },
  };
  expect(await discover(fetcher)).toEqual(['https://bigline.hk/tour-group/9109', 'https://bigline.hk/tour-group/624469']);
  expect(asked).toEqual(['https://bigline.hk/sitemap.xml', 'https://bigline.hk/sitemap-1.xml']);
});

it('discover returns [] when the sitemap cannot be fetched', async () => {
  expect(await discover({ fetchText: async () => null })).toEqual([]);
});

it('builds the detail URL and the dates body from a validated id and month', () => {
  expect(detailUrl('9109')).toBe('https://api.biglinehk.com/bigline/global/product/tour/frontend/detail?id=9109');
  expect(DATES_URL).toBe('https://api.biglinehk.com/bigline/global/product/release/page');
  expect(datesBody('9109', '2026-12')).toEqual({ pageNo: 1, productId: '9109', yearMonth: '2026-12', pageSize: 1000 });
});

it.each(['', '9109&x=1', '../9109', '9 109', '٩١٠٩', '0x10', '1e3'])('refuses to build a request for the id %j', id => {
  expect(() => detailUrl(id)).toThrow(/not a Big Line tour id/);
  expect(() => datesBody(id, '2026-12')).toThrow(/not a Big Line tour id/);
});

it.each(['2026-13', '2026-00', '2026-1', '202612', '2026-12-01', '2026-12&x', ''])('refuses the month %j', month => {
  expect(() => datesBody('9109', month)).toThrow(/not a month/);
});
