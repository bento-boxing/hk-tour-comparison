import { it, expect } from 'vitest';
// Next.js's own step that turns sitemap()'s list into the served XML, so the text below is what /sitemap.xml serves.
import { resolveRouteData } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data';
import sitemap from './sitemap';

const search = {
  'zh-Hant': 'https://ganbintuen.com',
  'zh-Hans': 'https://ganbintuen.com/zh-hans',
  en: 'https://ganbintuen.com/en',
  'x-default': 'https://ganbintuen.com',
};
const chain = {
  'zh-Hant': 'https://ganbintuen.com/chain',
  'zh-Hans': 'https://ganbintuen.com/zh-hans/chain',
  en: 'https://ganbintuen.com/en/chain',
  'x-default': 'https://ganbintuen.com/chain',
};

it('lists both pages in all three languages (six addresses), absolute, each with its language alternates, without a query string or a lastModified', () => {
  expect(sitemap()).toEqual([
    { url: 'https://ganbintuen.com', alternates: { languages: search } },
    { url: 'https://ganbintuen.com/zh-hans', alternates: { languages: search } },
    { url: 'https://ganbintuen.com/en', alternates: { languages: search } },
    { url: 'https://ganbintuen.com/chain', alternates: { languages: chain } },
    { url: 'https://ganbintuen.com/zh-hans/chain', alternates: { languages: chain } },
    { url: 'https://ganbintuen.com/en/chain', alternates: { languages: chain } },
  ]);
});

const links = (a: typeof search) =>
  `<xhtml:link rel="alternate" hreflang="zh-Hant" href="${a['zh-Hant']}" />\n` +
  `<xhtml:link rel="alternate" hreflang="zh-Hans" href="${a['zh-Hans']}" />\n` +
  `<xhtml:link rel="alternate" hreflang="en" href="${a.en}" />\n` +
  `<xhtml:link rel="alternate" hreflang="x-default" href="${a['x-default']}" />\n`;

it('/sitemap.xml reads exactly so', () => {
  const url = (loc: string, a: typeof search) => `<url>\n<loc>${loc}</loc>\n${links(a)}</url>\n`;
  expect(resolveRouteData(sitemap(), 'sitemap')).toBe(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    url('https://ganbintuen.com', search) +
    url('https://ganbintuen.com/zh-hans', search) +
    url('https://ganbintuen.com/en', search) +
    url('https://ganbintuen.com/chain', chain) +
    url('https://ganbintuen.com/zh-hans/chain', chain) +
    url('https://ganbintuen.com/en/chain', chain) +
    '</urlset>\n',
  );
});
