import { it, expect, vi, beforeEach, afterEach } from 'vitest';
// Next.js's own step that turns sitemap()'s list into the served XML, so the text below is what /sitemap.xml serves.
import { resolveRouteData } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data';
import { isIsoDate } from '@hktours/core';
import type { DateWindow, Db, DestinationCounts, ListedCount, OperatorListing } from '@hktours/db/read';
import { LUNAR_NEW_YEAR_FIRST_DAYS, LUNAR_NEW_YEAR_LAST_YEAR, currentWindows, type SeasonId, type SeasonWindow } from '../lib/seasons';

const mocks = vi.hoisted(() => ({
  requestDb: vi.fn<() => Promise<Db>>(),
  countToursByDestination: vi.fn<(db: Db, today: string) => Promise<DestinationCounts>>(),
  getOperatorListings: vi.fn<(db: Db, today: string) => Promise<OperatorListing[]>>(),
  countToursInWindows: vi.fn<(db: Db, today: string, windows: DateWindow[]) => Promise<ListedCount[]>>(),
}));
vi.mock('../lib/db', () => ({ requestDb: mocks.requestDb }));
vi.mock('../lib/search-page-data', () => ({
  cachedReads: {
    countToursByDestination: mocks.countToursByDestination, getOperatorListings: mocks.getOperatorListings,
    countToursInWindows: mocks.countToursInWindows,
  },
}));

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

/**
 * Invented listings: two operators with tours (in the site's order), one with a good run but no tours now, and one
 * never scraped (the database leaves such an operator out; if one came through, it would still not be listed).
 */
const listing = (id: OperatorListing['id'], tours: number, lastGoodRunAt: string | null = '2026-11-12T18:00:00.000Z'): OperatorListing => ({
  id, nameZh: id, nameEn: id, color: '#000000', siteUrl: 'https://example.test', lastGoodRunAt, tours, countries: [],
});
const operators = [listing('egl', 5), listing('jetour', 0), listing('texpert', 4), listing('bigline', 3, null)];

/** Tours per season, as the stand-in read answers for each window it is asked about. */
const seasonTours = (tours: Partial<Record<SeasonId, number>>) => {
  mocks.countToursInWindows.mockImplementation(async (_db, _today, windows) =>
    (windows as SeasonWindow[]).map(w => ({ tours: tours[w.season] ?? 0, operators: tours[w.season] ? 1 : 0 })));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-22T04:00:00Z'));
  mocks.requestDb.mockReset().mockResolvedValue(fakeDb);
  mocks.countToursByDestination.mockReset().mockResolvedValue(counts);
  mocks.getOperatorListings.mockReset().mockResolvedValue(operators);
  // Christmas and Easter have tours; Lunar New Year has none yet.
  mocks.countToursInWindows.mockReset();
  seasonTours({ christmas: 4, easter: 1 });
});
afterEach(() => { vi.useRealTimers(); });

const languages = (path: string) => {
  const zh = `https://example.invalid${path === '/' ? '' : path}`;
  return {
    'zh-Hant': zh,
    'zh-Hans': `https://example.invalid/zh-hans${path === '/' ? '' : path}`,
    en: `https://example.invalid/en${path === '/' ? '' : path}`,
    'x-default': zh,
  };
};
const entries = (path: string) => {
  const a = languages(path);
  return [a['zh-Hant'], a['zh-Hans'], a.en].map(url => ({ url, alternates: { languages: a } }));
};

it('lists the fixed pages, then each destination with a page of its own, then each operator listing tours, then each season with tours, in all three languages, absolute, with alternates, without a query string or a lastModified', async () => {
  expect(await sitemap()).toEqual([
    ...entries('/'), ...entries('/chain'), ...entries('/tours'), ...entries('/about'), ...entries('/operators'),
    // The index's order: parts of the world (中國內地及港澳台 first), countries, then their regions in data order.
    // Not listed: the area china-area-east, France's only region, and every destination without tours.
    ...entries('/tours/china'),
    ...entries('/tours/japan'), ...entries('/tours/japan-kanto'), ...entries('/tours/japan-kansai'),
    ...entries('/tours/france'),
    // The operators in the site's order; jetour lists no tours now (its page is noindex); bigline was never scraped.
    ...entries('/operators/egl'), ...entries('/operators/texpert'),
    // The seasons in the site's order, those with tours in their current days: Lunar New Year has none.
    ...entries('/seasons/christmas'), ...entries('/seasons/easter'),
  ]);
  expect(mocks.countToursByDestination).toHaveBeenCalledTimes(1);
  const [db, today] = mocks.countToursByDestination.mock.calls[0];
  expect(db).toBe(fakeDb);
  expect(isIsoDate(today)).toBe(true);
  expect(mocks.getOperatorListings.mock.calls).toEqual([[fakeDb, today]]);
  // One read for the three seasons' current windows on the same today.
  expect(mocks.countToursInWindows.mock.calls).toEqual([[fakeDb, today, currentWindows(today)]]);
});

it('a season leaves the sitemap while its current days have no tours, and comes back with them', async () => {
  seasonTours({});
  expect((await sitemap()).some(e => e.url.includes('/seasons/'))).toBe(false);
  seasonTours({ 'lunar-new-year': 2 });
  expect((await sitemap()).filter(e => e.url.includes('/seasons/')).map(e => e.url)).toEqual([
    'https://example.invalid/seasons/lunar-new-year', 'https://example.invalid/zh-hans/seasons/lunar-new-year',
    'https://example.invalid/en/seasons/lunar-new-year',
  ]);
});

it(`past the Lunar New Year table's end (${LUNAR_NEW_YEAR_LAST_YEAR}), that page is not in the sitemap and its window is not read`, async () => {
  const last = LUNAR_NEW_YEAR_FIRST_DAYS[LUNAR_NEW_YEAR_LAST_YEAR];
  // The day after its last window (4 days after its first day): Christmas and Easter go on.
  vi.setSystemTime(new Date(`${last}T04:00:00Z`).getTime() + 5 * 86_400_000);
  seasonTours({ christmas: 1, 'lunar-new-year': 1, easter: 1 });
  const urls = (await sitemap()).map(e => e.url);
  expect(urls.some(url => url.includes('/seasons/lunar-new-year'))).toBe(false);
  expect(urls).toContain('https://example.invalid/seasons/christmas');
  expect(urls).toContain('https://example.invalid/seasons/easter');
  expect((mocks.countToursInWindows.mock.calls[0][2] as SeasonWindow[]).map(w => w.season)).toEqual(['christmas', 'easter']);
});

it('still starts with the six addresses it had before destinations had pages', async () => {
  const urls = (await sitemap()).map(e => e.url);
  expect(urls.slice(0, 6)).toEqual([
    'https://example.invalid', 'https://example.invalid/zh-hans', 'https://example.invalid/en',
    'https://example.invalid/chain', 'https://example.invalid/zh-hans/chain', 'https://example.invalid/en/chain',
  ]);
});

it('with no tours at all, lists only the fixed pages', async () => {
  mocks.countToursByDestination.mockResolvedValue({ all: { tours: 0, operators: 0 }, destinations: [] });
  mocks.getOperatorListings.mockResolvedValue(operators.map(o => ({ ...o, tours: 0 })));
  seasonTours({});
  expect((await sitemap()).map(e => e.url)).toHaveLength(15);
});

it('a database that cannot be read fails the sitemap (the route answers 500) rather than giving a short one', async () => {
  const error = new Error('connection refused');
  mocks.countToursByDestination.mockRejectedValue(error);
  await expect(sitemap()).rejects.toBe(error);
  mocks.countToursByDestination.mockResolvedValue(counts);
  mocks.getOperatorListings.mockRejectedValue(error);
  await expect(sitemap()).rejects.toBe(error);
  mocks.getOperatorListings.mockResolvedValue(operators);
  mocks.countToursInWindows.mockRejectedValue(error);
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
  mocks.getOperatorListings.mockResolvedValue([listing('egl', 1)]);
  seasonTours({ easter: 1 });
  const url = (path: string) => {
    const a = languages(path);
    return [a['zh-Hant'], a['zh-Hans'], a.en].map(loc => `<url>\n<loc>${loc}</loc>\n${links(a)}</url>\n`).join('');
  };
  expect(resolveRouteData(await sitemap(), 'sitemap')).toBe(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    url('/') + url('/chain') + url('/tours') + url('/about') + url('/operators') + url('/tours/japan') + url('/operators/egl') +
    url('/seasons/easter') +
    '</urlset>\n',
  );
});
