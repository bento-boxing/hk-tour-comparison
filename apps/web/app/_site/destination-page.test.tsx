import { it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Db, DestinationCounts, TourCardData } from '@hktours/db/read';
import { I18nProvider } from '../../lib/i18n-client';
import { makeT, type Locale } from '../../lib/i18n';
import { shareImage } from '../../lib/share-images';
import type { SearchPageData } from '../../lib/search-page-data';
import { parseSearchParams } from '../../lib/search-params';
import { places } from '@hktours/core';
import { destinationName } from '../../lib/destinations';
import { fullWidth, sentences } from '../../lib/text-width.test-utils';

const mocks = vi.hoisted(() => ({
  requestDb: vi.fn<() => Promise<Db>>(),
  loadSearchPage: vi.fn<(db: Db, raw: Record<string, string | string[] | undefined>, today: string, locale?: string, reads?: unknown) => Promise<SearchPageData>>(),
}));
vi.mock('../../lib/db', () => ({ requestDb: mocks.requestDb }));
vi.mock('../../lib/search-page-data', () => ({
  loadSearchPage: mocks.loadSearchPage,
  // The band's seasons (lib/season-counts.ts): none has tours here.
  cachedReads: { name: 'cachedReads', countToursInWindows: async (_db: unknown, _today: string, windows: unknown[]) => windows.map(() => ({ tours: 0, operators: 0 })) },
}));
vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()), // the real notFound and unstable_rethrow
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/tours/japan',
  useSearchParams: () => new URLSearchParams(),
}));

const { DestinationPage, destinationDescription, destinationPageMetadata } = await import('./destination-page');

const fakeDb = {} as Db;
beforeAll(() => { vi.setSystemTime(new Date('2026-11-12T04:00:00Z')); });
afterAll(() => { vi.useRealTimers(); });

const tour: TourCardData = {
  key: 'egl:KIX5', operatorId: 'egl', url: 'https://example.test/egl/KIX5', title: 'KIX5', days: 5, nights: 4,
  stops: [{ countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' }],
  start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
  fromPriceHkd: 7999, windowPriceHkd: 7999, fallbackPriceHkd: 7999,
  departures: [{ date: '2026-12-18', priceHkd: 7999 }], priceChange: null, lastUpdated: '2026-11-11T19:10:00Z',
};

/**
 * Invented counts: Japan with two regions, an area with a tour, France with its only region, Korea. Japan's lines carry
 * their lengths and lowest price, as the database gives them; the others do not, as counts from before.
 */
const counts: DestinationCounts = {
  all: { tours: 50, operators: 4 },
  destinations: [
    { countryId: 'china', regionId: null, tours: 2, operators: 1 },
    { countryId: 'china', regionId: 'china-area-east', tours: 1, operators: 1 },
    { countryId: 'china', regionId: 'china-beijing', tours: 1, operators: 1 },
    { countryId: 'france', regionId: null, tours: 3, operators: 1 },
    { countryId: 'france', regionId: 'france-france', tours: 3, operators: 1 },
    { countryId: 'japan', regionId: null, tours: 32, operators: 3, range: { minDays: 4, maxDays: 11, minPriceHkd: 3999 } },
    { countryId: 'japan', regionId: 'japan-kansai', tours: 30, operators: 2, range: { minDays: 5, maxDays: 5, minPriceHkd: 4599 } },
    { countryId: 'japan', regionId: 'japan-kanto', tours: 1, operators: 1 },
  ],
};

/** What the loader gives for a destination's page: its state from the address the page hands it. */
function dataFor(raw: Record<string, string | string[] | undefined>): SearchPageData {
  return {
    state: parseSearchParams(raw, places), tours: [tour], total: 30,
    operators: [{ id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: null }],
    filterOperators: [], counts,
  };
}

const props = (locale: Locale, id: string, query: Record<string, string> = {}) =>
  ({ locale, params: Promise.resolve({ id }), searchParams: Promise.resolve(query) });

async function renderPage(locale: Locale, id: string, query: Record<string, string> = {}) {
  const element = await DestinationPage(props(locale, id, query));
  return render(<I18nProvider locale={locale}>{element}</I18nProvider>);
}

async function thrown(run: () => Promise<unknown>): Promise<{ digest?: string } | undefined> {
  try { await run(); } catch (err) { return err as { digest?: string }; }
  return undefined;
}

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.requestDb.mockReset().mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockReset().mockImplementation(async (_db, raw) => dataFor(raw));
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { consoleError.mockRestore(); });

it.each([
  ['an unknown id', 'atlantis'], ['a city', 'japan-kansai-osaka'], ['a capitalised id', 'Japan'],
  ['a retired region (split into provinces)', 'china-central'], ['another retired region', 'china-northeast'],
])('%s (%s) is a real 404, from the page and from its metadata, with no database read', async (_, id) => {
  for (const locale of ['zh-Hant', 'zh-Hans', 'en'] as const) {
    expect((await thrown(() => DestinationPage(props(locale, id))))?.digest).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
    expect((await thrown(() => destinationPageMetadata(locale, props(locale, id).params, props(locale, id).searchParams)))?.digest)
      .toBe('NEXT_HTTP_ERROR_FALLBACK;404');
  }
  expect(mocks.requestDb).not.toHaveBeenCalled();
  expect(mocks.loadSearchPage).not.toHaveBeenCalled();
});

it('the destination comes from the path: a dest in the query is ignored, and the other filters are read', async () => {
  await renderPage('zh-Hant', 'japan', { dest: 'korea', dmin: '5' });
  expect(mocks.loadSearchPage).toHaveBeenCalledTimes(1);
  expect(mocks.loadSearchPage.mock.calls[0][1]).toEqual({ dmin: '5', dest: 'japan' });
  expect(screen.getByRole('combobox')).toHaveValue('日本 → 全部地區');
});

/** The band's first row ("where", named by its label) as [accessible name, address]. */
const whereRow = (label: string) =>
  within(screen.getByRole('navigation', { name: label })).getAllByRole('link').map(a => [a.getAttribute('aria-label') ?? a.textContent, a.getAttribute('href')]);

it.each([
  ['zh-Hant', '日本旅行團', '現時列出 32 個旅行團，來自 3 間旅行社。', '日本地區', [['日本 32 團，已選取，按此取消', '/'], ['關西 30 團', '/tours/japan-kansai'], ['關東 1 團', '/tours/japan-kanto']]],
  ['zh-Hans', '日本旅行团', '目前列出 32 个旅行团，来自 3 家旅行社。', '日本地区', [['日本 32 团，已选取，按此取消', '/zh-hans'], ['关西 30 团', '/zh-hans/tours/japan-kansai'], ['关东 1 团', '/zh-hans/tours/japan-kanto']]],
  ['en', 'Group tours to Japan', 'Listing 32 tours from 3 operators.', 'Regions of Japan', [['Japan, 32 tours, selected: press to remove', '/en'], ['Kansai 30 tours', '/en/tours/japan-kansai'], ['Kanto 1 tour', '/en/tours/japan-kanto']]],
] as const)('in %s a country\'s page: its heading, the line of real counts, and the band\'s first row: the country chosen, then its regions that have tours', async (locale, heading, line, label, regions) => {
  await renderPage(locale, 'japan');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  expect(screen.getByText(line)).toBeInTheDocument();
  expect(whereRow(label)).toEqual(regions.map(r => [...r]));
});

it.each([
  ['zh-Hant', '日本關西旅行團', '現時列出 30 個旅行團，來自 2 間旅行社。', '日本地區', [['日本 32 團', '/tours/japan'], ['關西 30 團，已選取，按此取消', '/tours/japan'], ['關東 1 團', '/tours/japan-kanto']]],
  ['en', 'Group tours to Kansai, Japan', 'Listing 30 tours from 2 operators.', 'Regions of Japan', [['Japan 32 tours', '/en/tours/japan'], ['Kansai, 30 tours, selected: press to remove', '/en/tours/japan'], ['Kanto 1 tour', '/en/tours/japan-kanto']]],
] as const)('in %s a region\'s page: its heading, its counts, and its country\'s row: the country (a way to it), the region chosen (back to the country)', async (locale, heading, line, label, boxes) => {
  await renderPage(locale, 'japan-kansai');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  expect(screen.getByText(line)).toBeInTheDocument();
  expect(whereRow(label)).toEqual(boxes.map(b => [...b]));
});

it('a destination with no tours now answers as usual, with the no-tours state', async () => {
  mocks.loadSearchPage.mockImplementation(async (_db, raw) => ({ ...dataFor(raw), tours: [], total: 0 }));
  await renderPage('zh-Hant', 'japan-okinawa');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('日本沖繩旅行團');
  expect(screen.getByText('現時沒有列出旅行團。')).toBeInTheDocument();
  expect(screen.getByText('找不到符合條件的旅行團')).toBeInTheDocument();
  // Not one of Japan's listed regions: its own box first, chosen (a way out), then the top destinations.
  expect(whereRow('熱門目的地')[0]).toEqual(['日本沖繩 0 團，已選取，按此取消', '/']);
});

it.each([
  ['zh-Hant', '清除所有篩選', '/tours/japan'],
  ['zh-Hans', '清除所有筛选条件', '/zh-hans/tours/japan'],
  ['en', 'Clear all filters', '/en/tours/japan'],
] as const)('in %s, with no results on a destination\'s page, "clear all filters" keeps the destination', async (locale, clear, href) => {
  mocks.loadSearchPage.mockImplementation(async (_db, raw) => ({ ...dataFor(raw), tours: [], total: 0 }));
  await renderPage(locale, 'japan', { dmin: '30', op: 'egl' });
  expect(screen.getByRole('link', { name: clear })).toHaveAttribute('href', href);
});

it('the database being down: the heading, then the message in the page\'s language', async () => {
  mocks.loadSearchPage.mockRejectedValue(new Error('connection refused'));
  await renderPage('en', 'japan');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Group tours to Japan');
  expect(screen.getByRole('alert')).toHaveTextContent("Tours can't be loaded right now. Please try again later.");
  expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('search page'), expect.any(Error));
});

const metadata = (locale: Locale, id: string, query: Record<string, string> = {}) =>
  destinationPageMetadata(locale, Promise.resolve({ id }), Promise.resolve(query));

it.each([
  ['zh-Hant', 'japan', '日本旅行團比較', '比較香港 3 間旅行社的 32 個日本旅行團，行程 4 至 11 天，團費由 HK$3,999 起。可按出發日期、天數及價錢篩選，報名請到旅行社自己的網站。', 'https://example.invalid/tours/japan', 'zh_HK'],
  ['zh-Hans', 'japan', '日本旅行团比较', '比较香港 3 家旅行社的 32 个日本旅行团，行程 4 至 11 天，团费 HK$3,999 起。可按出发日期、天数和价格筛选，报名请前往旅行社自己的网站。', 'https://example.invalid/zh-hans/tours/japan', 'zh_CN'],
  ['en', 'japan', 'Group tours to Japan compared', "Compare 32 group tours to Japan from 3 Hong Kong operators: 4 to 11 days, from HK$3,999. Book on the operator's own website.", 'https://example.invalid/en/tours/japan', 'en_GB'],
  ['zh-Hant', 'japan-kansai', '日本關西旅行團比較', '比較香港 2 間旅行社的 30 個日本關西旅行團，行程 5 天，團費由 HK$4,599 起。可按出發日期、天數及價錢篩選，報名請到旅行社自己的網站。', 'https://example.invalid/tours/japan-kansai', 'zh_HK'],
  // Counts without lengths and price (made before they were read): the counts alone.
  ['zh-Hans', 'china-beijing', '中国北京旅行团比较', '比较香港 1 家旅行社的 1 个中国北京旅行团。可按出发日期、天数和价格筛选，报名请前往旅行社自己的网站。', 'https://example.invalid/zh-hans/tours/china-beijing', 'zh_CN'],
] as const)('in %s, %s: titled with the place and described with its facts before any filter, canonical without the query string, the three languages and x-default, indexable', async (locale, id, title, description, canonical, ogLocale) => {
  expect(await metadata(locale, id, { dmin: '5', sort: 'days' })).toEqual({
    title, description,
    alternates: {
      canonical,
      languages: {
        'zh-Hant': `https://example.invalid/tours/${id}`, 'zh-Hans': `https://example.invalid/zh-hans/tours/${id}`,
        en: `https://example.invalid/en/tours/${id}`, 'x-default': `https://example.invalid/tours/${id}`,
      },
    },
    openGraph: { title: `${title} | 跟邊團`, description, siteName: '跟邊團', locale: ogLocale, type: 'website', images: [shareImage(makeT(locale))] },
    twitter: { card: 'summary_large_image' },
  });
});

it('the description is the destination\'s own, whatever the address\'s filters (the canonical page has none)', async () => {
  const bare = (await metadata('zh-Hant', 'japan')).description;
  // A filter that finds nothing: the page's own list is empty, its description is not.
  mocks.loadSearchPage.mockImplementation(async (_db, raw) => ({ ...dataFor(raw), tours: [], total: 0 }));
  expect((await metadata('zh-Hant', 'japan', { dmin: '30', op: 'egl', pmax: '100' })).description).toBe(bare);
  expect(bare).toContain('32 個日本旅行團');
});

it('with no tours now, or the tours unreadable, the plain description without numbers', async () => {
  expect((await metadata('zh-Hant', 'japan-okinawa')).description).toBe('比較香港多間旅行社的日本沖繩旅行團，可按出發日期、天數及價錢篩選，再到旅行社自己的網站報名。');
  mocks.loadSearchPage.mockRejectedValue(new Error('connection refused'));
  expect((await metadata('en', 'japan')).description)
    .toBe("Compare group tours to Japan from several Hong Kong tour operators. Filter by departure date, length and price, then book on the operator's own website.");
});

it('English counts in the singular for one, and every count and price with thousands commas', () => {
  const en = makeT('en');
  expect(destinationDescription(en, 'Japan', { tours: 1, operators: 1, range: { minDays: 1, maxDays: 1, minPriceHkd: 100 } }))
    .toBe("Compare 1 group tour to Japan from 1 Hong Kong operator: 1 day, from HK$100. Book on the operator's own website.");
  expect(destinationDescription(en, 'Japan', { tours: 12345, operators: 12, range: { minDays: 2, maxDays: 2, minPriceHkd: 123456 } }))
    .toBe("Compare 12,345 group tours to Japan from 12 Hong Kong operators: 2 days, from HK$123,456. Book on the operator's own website.");
  expect(destinationDescription(makeT('zh-Hant'), '日本', { tours: 12345, operators: 12, range: { minDays: 3, maxDays: 30, minPriceHkd: 123456 } }))
    .toBe('比較香港 12 間旅行社的 12,345 個日本旅行團，行程 3 至 30 天，團費由 HK$123,456 起。可按出發日期、天數及價錢篩選，報名請到旅行社自己的網站。');
});

it.each(['zh-Hant', 'zh-Hans', 'en'] as const)('in %s every destination\'s description, at the largest plausible numbers and with the longest name, is one or two sentences within 80 full-width characters (as the home page\'s)', locale => {
  const t = makeT(locale);
  const names = [
    ...places.data.countries.map(c => ({ countryId: c.id, regionId: null })),
    ...places.data.regions.map(r => ({ countryId: r.countryId, regionId: r.id })),
  ].map(d => destinationName(d, places, t));
  const longest = names.reduce((a, b) => (fullWidth(b) > fullWidth(a) ? b : a));
  for (const place of [longest, ...names]) {
    for (const count of [
      { tours: 99999, operators: 99, range: { minDays: 1, maxDays: 60, minPriceHkd: 999999 } },
      { tours: 99999, operators: 99 },
      { tours: 1, operators: 1, range: { minDays: 1, maxDays: 1, minPriceHkd: 100 } },
    ]) {
      const description = destinationDescription(t, place, count);
      expect(fullWidth(description), description).toBeLessThanOrEqual(80);
      expect(sentences(description).length, description).toBeLessThanOrEqual(2);
      expect(description).toContain(place);
    }
  }
});

it('every destination has its own title', async () => {
  const titles = await Promise.all(['japan', 'japan-kansai', 'japan-kanto', 'korea', 'china-beijing'].map(async id => (await metadata('zh-Hant', id)).title));
  expect(new Set(titles).size).toBe(titles.length);
});

it.each([
  ['a destination with no tours now', 'japan-okinawa'],
  ['a country with no tours now', 'thailand'],
  ['an area region, though it has a tour', 'china-area-east'],
  ['the only region of its country (the country\'s page lists the same tours)', 'france-france'],
])('%s (%s) answers, but is marked noindex', async (_, id) => {
  for (const locale of ['zh-Hant', 'zh-Hans', 'en'] as const) {
    const meta = await metadata(locale, id);
    expect(meta.robots, `${locale} ${id}`).toEqual({ index: false });
    expect(meta.alternates?.canonical).toMatch(new RegExp(`/tours/${id}$`));
  }
  await renderPage('zh-Hant', id);
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
});

it('when the tours cannot be read, the page is marked noindex', async () => {
  mocks.loadSearchPage.mockRejectedValue(new Error('connection refused'));
  expect((await metadata('zh-Hant', 'japan')).robots).toEqual({ index: false });
});

it('a listed destination is not marked noindex, whatever the filters', async () => {
  const queries: Record<string, string>[] = [{}, { dmin: '60' }, { page: '99' }];
  for (const query of queries) expect(await metadata('en', 'japan', query)).not.toHaveProperty('robots');
});

it('an area\'s page: its own box chosen first, then the top destinations, its country among them', async () => {
  await renderPage('zh-Hant', 'china-area-east');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('中國華東旅行團');
  const row = whereRow('熱門目的地');
  expect(row[0]).toEqual(['中國華東 1 團，已選取，按此取消', '/']);
  expect(row).toContainEqual(['中國 2 團', '/tours/china']);
});

// Structured data (task 64): the page's place in the site, from its path; no list of its tours.

it.each([
  ['zh-Hant', 'japan-kansai', '', ['跟邊團', '旅行團目的地', '日本關西旅行團']],
  ['zh-Hans', 'japan', '/zh-hans', ['跟邊團', '旅行团目的地', '日本旅行团']],
  ['en', 'japan-kansai', '/en', ['跟邊團', 'Tour destinations', 'Group tours to Kansai, Japan']],
] as const)('in %s, %s: one breadcrumb trail, the home page, the destinations index, then this page under its heading; no other block', async (locale, id, prefix, names) => {
  const site = 'https://example.invalid';
  const { container } = await renderPage(locale, id, { dmin: '5', page: '2' });
  const blocks = [...container.querySelectorAll('script[type="application/ld+json"]')];
  expect(blocks).toHaveLength(1);
  expect(JSON.parse(blocks[0].textContent!)).toEqual({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: names[0], item: `${site}${prefix}` },
      { '@type': 'ListItem', position: 2, name: names[1], item: `${site}${prefix}/tours` },
      { '@type': 'ListItem', position: 3, name: names[2], item: `${site}${prefix}/tours/${id}` },
    ],
  });
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(names[2]);
});

it('the trail needs no data: it is there when the tours cannot be read, and on a destination without a page of its own', async () => {
  mocks.loadSearchPage.mockRejectedValue(new Error('connection refused'));
  const failed = await renderPage('zh-Hant', 'japan');
  expect(failed.container.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
  failed.unmount();
  mocks.loadSearchPage.mockReset().mockImplementation(async (_db, raw) => dataFor(raw));
  const area = await renderPage('zh-Hant', 'china-area-east');
  const [block] = area.container.querySelectorAll('script[type="application/ld+json"]');
  expect(JSON.parse(block.textContent!).itemListElement[2].name).toBe('中國華東旅行團');
});
