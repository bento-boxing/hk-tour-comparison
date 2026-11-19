import { it, expect } from 'vitest';
// Next.js's own step that turns sitemap()'s list into the served XML, so the text below is what /sitemap.xml serves.
import { resolveRouteData } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data';
import sitemap from './sitemap';

it('lists the two pages by absolute address, without a query string or a lastModified', () => {
  expect(sitemap()).toEqual([
    { url: 'https://ganbintuen.com' },
    { url: 'https://ganbintuen.com/chain' },
  ]);
});

it('/sitemap.xml reads exactly so', () => {
  expect(resolveRouteData(sitemap(), 'sitemap')).toBe(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '<url>\n<loc>https://ganbintuen.com</loc>\n</url>\n' +
    '<url>\n<loc>https://ganbintuen.com/chain</loc>\n</url>\n' +
    '</urlset>\n',
  );
});
