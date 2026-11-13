import { expect, it } from 'vitest';
import type { Fetcher } from '../../types';
import { datesUrl, discover, isTourUrl } from './discover';

// Real URLs from https://www.egltours.com/sitemap.xml (docs/operators/egl.md), plus off-site variants.
it.each([
  ['https://www.egltours.com/website/itinerary/HTJSJG06', true],
  ['https://www.egltours.com/website/itinerary/HTGSZK02', true],
  ['https://www.egltours.com/website/itinerary/MTJ3TA06', true],
  ['https://www.egltours.com/website/itinerary/HTJSHA07', true],
  ['https://www.egltours.com/website/itinerary/HTJSGF06/', true],
  ['https://www.egltours.com/website/itinerary-premier/HESAMA19', false], // another page template, not examined
  ['https://www.egltours.com/website/itinerary-hii-fly/HFLKUA09', false], // another page template, not examined
  ['https://www.egltours.com/website/tour-location/北海道', false],
  ['https://www.egltours.com/website/tour-line/日本線', false],
  ['https://www.egltours.com/local-travel/product/activities', false],
  ['https://www.egltours.com/blog/hokkaido-tours', false],
  ['https://www.egltours.com/website/cruise', false],
  ['https://www.egltours.com/website/location-search-result', false],
  ['https://www.egltours.com/website/itinerary/HCABCD05', false], // the site's own script sends hc… codes to /website/cruise
  ['https://www.egltours.com/website/itinerary/hcabcd05', false],
  ['https://www.egltours.com/website/itinerary/', false],
  ['https://www.egltours.com/website/itinerary/HTJS%2F06', false],
  ['http://www.egltours.com/website/itinerary/HTJSJG06', false],
  ['https://egltours.com/website/itinerary/HTJSJG06', false],
  ['https://www.egltours.com.example.test/website/itinerary/HTJSJG06', false],
  ['not a url', false],
])('isTourUrl(%s) is %s', (url, expected) => {
  expect(isTourUrl(url)).toBe(expected);
});

it('discover returns only the tour URLs from the sitemap, de-duplicated, without query strings', async () => {
  const sitemap = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
    <url><loc>https://www.egltours.com/</loc><lastmod>2026-11-12</lastmod></url>
    <url><loc>https://www.egltours.com/website/itinerary/HTJSJG06</loc></url>
    <url><loc>https://www.egltours.com/website/tour-location/北海道</loc></url>
    <url><loc>https://www.egltours.com/website/itinerary/MTJ3TA06</loc></url>
    <url><loc>https://www.egltours.com/website/itinerary-premier/HESAMA19</loc></url>
    <url><loc>https://www.egltours.com/website/itinerary/HTJSJG06</loc></url>
    <url><loc>https://www.egltours.com/website/itinerary/MTJ3TA06?ref=sitemap</loc></url>
    <url><loc>https://www.egltours.com/blog/hokkaido-tours</loc></url>
</urlset>`;
  const asked: string[] = [];
  const fetcher: Fetcher = {
    fetchText: async url => {
      asked.push(url);
      return url === 'https://www.egltours.com/sitemap.xml' ? sitemap : null;
    },
  };
  expect(await discover(fetcher)).toEqual([
    'https://www.egltours.com/website/itinerary/HTJSJG06',
    'https://www.egltours.com/website/itinerary/MTJ3TA06',
  ]);
  expect(asked).toEqual(['https://www.egltours.com/sitemap.xml']);
});

it('discover returns [] when the sitemap cannot be fetched', async () => {
  expect(await discover({ fetchText: async () => null })).toEqual([]);
});

it('datesUrl is the JSON dates request for a tour code, in HKD', () => {
  expect(datesUrl('HTJSJG06')).toBe('https://www.egltours.com/api/v1/tours/HTJSJG06/dates?currencyCode=HKD');
});
