import { it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Db, DestinationCounts, TourCardData } from '@hktours/db/read';
import { I18nProvider } from '../../lib/i18n-client';
import type { Locale } from '../../lib/i18n';
import type { SearchPageData } from '../../lib/search-page-data';
import { parseSearchParams } from '../../lib/search-params';
import { places } from '@hktours/core';

const mocks = vi.hoisted(() => ({
  requestDb: vi.fn<() => Promise<Db>>(),
  loadSearchPage: vi.fn<(db: Db, raw: Record<string, string | string[] | undefined>, today: string, locale?: string, reads?: unknown) => Promise<SearchPageData>>(),
}));
vi.mock('../../lib/db', () => ({ requestDb: mocks.requestDb }));
vi.mock('../../lib/search-page-data', () => ({ loadSearchPage: mocks.loadSearchPage, cachedReads: { name: 'cachedReads' } }));
vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()), // the real notFound and unstable_rethrow
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/tours/japan',
  useSearchParams: () => new URLSearchParams(),
}));

const { DestinationPage, destinationPageMetadata } = await import('./destination-page');

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

/** Invented counts: Japan with two regions, an area with a tour, France with its only region, Korea. */
const counts: DestinationCounts = {
  all: { tours: 50, operators: 4 },
  destinations: [
    { countryId: 'china', regionId: null, tours: 2, operators: 1 },
    { countryId: 'china', regionId: 'china-area-east', tours: 1, operators: 1 },
    { countryId: 'china', regionId: 'china-beijing', tours: 1, operators: 1 },
    { countryId: 'france', regionId: null, tours: 3, operators: 1 },
    { countryId: 'france', regionId: 'france-france', tours: 3, operators: 1 },
    { countryId: 'japan', regionId: null, tours: 32, operators: 3 },
    { countryId: 'japan', regionId: 'japan-kansai', tours: 30, operators: 2 },
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

it.each([
  ['zh-Hant', '日本旅行團', '現時列出 32 個旅行團，來自 3 間旅行社。', '地區：', [['關東', '/tours/japan-kanto'], ['關西', '/tours/japan-kansai']]],
  ['zh-Hans', '日本旅行团', '目前列出 32 个旅行团，来自 3 家旅行社。', '地区：', [['关东', '/zh-hans/tours/japan-kanto'], ['关西', '/zh-hans/tours/japan-kansai']]],
  ['en', 'Group tours to Japan', 'Listing 32 tours from 3 operators.', 'Regions:', [['Kanto', '/en/tours/japan-kanto'], ['Kansai', '/en/tours/japan-kansai']]],
] as const)('in %s a country\'s page: its heading, the line of real counts, and links to its regions that have tours', async (locale, heading, line, label, regions) => {
  await renderPage(locale, 'japan');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  expect(screen.getByText(line)).toBeInTheDocument();
  const related = screen.getByText(label, { exact: false });
  expect([...related.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')])).toEqual(regions);
});

it.each([
  ['zh-Hant', '日本關西旅行團', '現時列出 30 個旅行團，來自 2 間旅行社。', '日本全部旅行團', '/tours/japan'],
  ['zh-Hans', '日本关西旅行团', '目前列出 30 个旅行团，来自 2 家旅行社。', '日本全部旅行团', '/zh-hans/tours/japan'],
  ['en', 'Group tours to Kansai, Japan', 'Listing 30 tours from 2 operators.', 'All tours to Japan', '/en/tours/japan'],
] as const)('in %s a region\'s page: its heading, its counts, and a link to its country', async (locale, heading, line, country, href) => {
  await renderPage(locale, 'japan-kansai');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  expect(screen.getByText(line)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: country })).toHaveAttribute('href', href);
});

it('a destination with no tours now answers as usual, with the no-tours state', async () => {
  mocks.loadSearchPage.mockImplementation(async (_db, raw) => ({ ...dataFor(raw), tours: [], total: 0 }));
  await renderPage('zh-Hant', 'japan-okinawa');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('日本沖繩旅行團');
  expect(screen.getByText('現時沒有列出旅行團。')).toBeInTheDocument();
  expect(screen.getByText('找不到符合條件的旅行團')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '日本全部旅行團' })).toHaveAttribute('href', '/tours/japan');
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
  ['zh-Hant', 'japan', '日本旅行團比較', '比較香港多間旅行社的日本旅行團，可按出發日期、日數及價錢篩選，再到旅行社自己的網站報名。', 'https://example.invalid/tours/japan', 'zh_HK'],
  ['zh-Hans', 'japan', '日本旅行团比较', '比较香港多家旅行社的日本旅行团，可按出发日期、天数和价格筛选，再前往旅行社自己的网站报名。', 'https://example.invalid/zh-hans/tours/japan', 'zh_CN'],
  ['en', 'japan', 'Group tours to Japan compared', "Compare group tours to Japan from several Hong Kong tour operators. Filter by departure date, length and price, then book on the operator's own website.", 'https://example.invalid/en/tours/japan', 'en_GB'],
  ['zh-Hans', 'china-beijing', '中国北京旅行团比较', '比较香港多家旅行社的中国北京旅行团，可按出发日期、天数和价格筛选，再前往旅行社自己的网站报名。', 'https://example.invalid/zh-hans/tours/china-beijing', 'zh_CN'],
] as const)('in %s, %s: titled and described with the place, canonical without the query string, the three languages and x-default, indexable', async (locale, id, title, description, canonical, ogLocale) => {
  expect(await metadata(locale, id, { dmin: '5', sort: 'days' })).toEqual({
    title, description,
    alternates: {
      canonical,
      languages: {
        'zh-Hant': `https://example.invalid/tours/${id}`, 'zh-Hans': `https://example.invalid/zh-hans/tours/${id}`,
        en: `https://example.invalid/en/tours/${id}`, 'x-default': `https://example.invalid/tours/${id}`,
      },
    },
    openGraph: { title: `${title} | 跟邊團`, description, siteName: '跟邊團', locale: ogLocale, type: 'website' },
  });
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

it('an area\'s page links to its country', async () => {
  await renderPage('zh-Hant', 'china-area-east');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('中國華東旅行團');
  const related = screen.getByRole('link', { name: '中國全部旅行團' });
  expect(related).toHaveAttribute('href', '/tours/china');
  expect(within(related.parentElement!).getAllByRole('link')).toHaveLength(1);
});
