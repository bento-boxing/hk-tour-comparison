import { it, expect, vi, beforeEach } from 'vitest';
// Next.js's own step that turns sitemap()'s list into the served XML, so the text below is what /sitemap.xml serves.
import { resolveRouteData } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data';
import { isIsoDate } from '@hktours/core';
import type { Db, DestinationCounts } from '@hktours/db/read';

const mocks = vi.hoisted(() => ({
  requestDb: vi.fn<() => Promise<Db>>(),
  countToursByDestination: vi.fn<(db: Db, today: string) => Promise<DestinationCounts>>(),
}));
vi.mock('../lib/db', () => ({ requestDb: mocks.requestDb }));
vi.mock('../lib/search-page-data', () => ({ cachedReads: { countToursByDestination: mocks.countToursByDestination } }));

const { default: sitemap } = await import('./sitemap');

const fakeDb = {} as Db;
/** Invented counts: Japan and two of its regions, an area with a tour, France and its only region, a country with none. */
const counts: DestinationCounts = {
  all: { tours: 9, operators: 3 },
  destinations: [
    { countryId: 'china', regionId: null, tours: 1, operators: 1 },
    { countryId: 'china', regionId: 'china-area-east', tours: 1, operators: 1 },
    { countryId: 'france', regionId: null, tours: 2, operators: 1 },
    { countryId: 'france', regionId: 'france-france', tours: 2, operators: 1 },
    { countryId: 'japan', regionId: null, tours: 6, operators: 3 },
    { countryId: 'japan', regionId: 'japan-kansai', tours: 4, operators: 2 },
    { countryId: 'japan', regionId: 'japan-kanto', tours: 2, operators: 2 },
  ],
};

beforeEach(() => {
  mocks.requestDb.mockReset().mockResolvedValue(fakeDb);
  mocks.countToursByDestination.mockReset().mockResolvedValue(counts);
});

const languages = (path: string) => {
  const zh = `https://ganbintuen.com${path === '/' ? '' : path}`;
  return {
    'zh-Hant': zh,
    'zh-Hans': `https://ganbintuen.com/zh-hans${path === '/' ? '' : path}`,
    en: `https://ganbintuen.com/en${path === '/' ? '' : path}`,
    'x-default': zh,
  };
};
const entries = (path: string) => {
  const a = languages(path);
  return [a['zh-Hant'], a['zh-Hans'], a.en].map(url => ({ url, alternates: { languages: a } }));
};

it('lists the fixed pages, then each destination with a page of its own, in all three languages, absolute, with alternates, without a query string or a lastModified', async () => {
  expect(await sitemap()).toEqual([
    ...entries('/'), ...entries('/chain'), ...entries('/tours'), ...entries('/about'),
    // The index's order: parts of the world (中國內地及港澳台 first), countries, then their regions in data order.
    // Not listed: the area china-area-east, France's only region, and every destination without tours.
    ...entries('/tours/china'),
    ...entries('/tours/japan'), ...entries('/tours/japan-kanto'), ...entries('/tours/japan-kansai'),
    ...entries('/tours/france'),
  ]);
  expect(mocks.countToursByDestination).toHaveBeenCalledTimes(1);
  const [db, today] = mocks.countToursByDestination.mock.calls[0];
  expect(db).toBe(fakeDb);
  expect(isIsoDate(today)).toBe(true);
});

it('still starts with the six addresses it had before destinations had pages', async () => {
  const urls = (await sitemap()).map(e => e.url);
  expect(urls.slice(0, 6)).toEqual([
    'https://ganbintuen.com', 'https://ganbintuen.com/zh-hans', 'https://ganbintuen.com/en',
    'https://ganbintuen.com/chain', 'https://ganbintuen.com/zh-hans/chain', 'https://ganbintuen.com/en/chain',
  ]);
});

it('with no tours at all, lists only the fixed pages', async () => {
  mocks.countToursByDestination.mockResolvedValue({ all: { tours: 0, operators: 0 }, destinations: [] });
  expect((await sitemap()).map(e => e.url)).toHaveLength(12);
});

it('a database that cannot be read fails the sitemap (the route answers 500) rather than giving a short one', async () => {
  const error = new Error('connection refused');
  mocks.countToursByDestination.mockRejectedValue(error);
  await expect(sitemap()).rejects.toBe(error);
  mocks.requestDb.mockRejectedValue(new Error('DATABASE_URL is not set'));
  await expect(sitemap()).rejects.toThrow('DATABASE_URL is not set');
});

const links = (a: ReturnType<typeof languages>) =>
  `<xhtml:link rel="alternate" hreflang="zh-Hant" href="${a['zh-Hant']}" />\n` +
  `<xhtml:link rel="alternate" hreflang="zh-Hans" href="${a['zh-Hans']}" />\n` +
  `<xhtml:link rel="alternate" hreflang="en" href="${a.en}" />\n` +
  `<xhtml:link rel="alternate" hreflang="x-default" href="${a['x-default']}" />\n`;

it('/sitemap.xml reads exactly so', async () => {
  mocks.countToursByDestination.mockResolvedValue({
    all: { tours: 1, operators: 1 }, destinations: [{ countryId: 'japan', regionId: null, tours: 1, operators: 1 }],
  });
  const url = (path: string) => {
    const a = languages(path);
    return [a['zh-Hant'], a['zh-Hans'], a.en].map(loc => `<url>\n<loc>${loc}</loc>\n${links(a)}</url>\n`).join('');
  };
  expect(resolveRouteData(await sitemap(), 'sitemap')).toBe(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    url('/') + url('/chain') + url('/tours') + url('/about') + url('/tours/japan') +
    '</urlset>\n',
  );
});
