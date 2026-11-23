import { monthWindow } from '../../lib/filter-sheet';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { places } from '@hktours/core';
import type { DateWindow, Db, DestinationCounts, ListedCount, TourCardData, WindowCount } from '@hktours/db/read';
import { I18nProvider } from '../../lib/i18n-client';
import { makeT, type Locale } from '../../lib/i18n';
import { shareImage } from '../../lib/share-images';
import type { SearchPageData } from '../../lib/search-page-data';
import { parseSearchParams } from '../../lib/search-params';
import { LUNAR_NEW_YEAR_LAST_YEAR, SEASON_IDS, seasonWindow, type SeasonId, type SeasonWindow } from '../../lib/seasons';
import { fullWidth, sentences } from '../../lib/text-width.test-utils';
import { resetBrowserTodayCache, setBrowserTodayClockForTests } from '../../lib/browser-today';

const mocks = vi.hoisted(() => ({
  requestDb: vi.fn<() => Promise<Db>>(),
  loadSearchPage: vi.fn<(db: Db, raw: Record<string, string | string[] | undefined>, today: string, locale?: string, reads?: unknown) => Promise<SearchPageData>>(),
  countToursInWindows: vi.fn<(db: Db, today: string, windows: DateWindow[]) => Promise<ListedCount[]>>(),
}));
vi.mock('../../lib/db', () => ({ requestDb: mocks.requestDb }));
vi.mock('../../lib/search-page-data', () => ({
  loadSearchPage: mocks.loadSearchPage, cachedReads: { name: 'cachedReads', countToursInWindows: mocks.countToursInWindows },
}));
vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()), // the real notFound and unstable_rethrow
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/seasons/christmas',
  useSearchParams: () => new URLSearchParams(),
}));

const { SeasonPage, seasonDescription, seasonPageMetadata } = await import('./season-page');

// The clock is set by injection (vitest's fake Date), never by changing the system's: Hong Kong's today is the
// server's, read by todayInHongKong() in the page's load.
const setToday = (hongKongDate: string) => vi.setSystemTime(new Date(`${hongKongDate}T04:00:00Z`)); // noon in Hong Kong
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); setToday('2026-11-22'); });
afterEach(() => { vi.useRealTimers(); });

const fakeDb = {} as Db;
const tour: TourCardData = {
  key: 'egl:KIX5', operatorId: 'egl', url: 'https://example.test/egl/KIX5', title: 'KIX5', days: 5, nights: 4,
  stops: [{ countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' }],
  start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
  fromPriceHkd: 7999, windowPriceHkd: 7999, fallbackPriceHkd: 7999,
  departures: [{ date: '2026-12-20', priceHkd: 7999 }], priceChange: null, lastUpdated: '2026-11-21T19:10:00Z',
};
const counts: DestinationCounts = { all: { tours: 50, operators: 4 }, destinations: [{ countryId: 'japan', regionId: null, tours: 30, operators: 3 }] };

/** What the loader gives: the state from the address the page hands it (with the season's dates), 30 matches. */
function dataFor(raw: Record<string, string | string[] | undefined>): SearchPageData {
  return {
    state: parseSearchParams(raw, places), tours: [tour], total: 30,
    operators: [{ id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: null }],
    filterOperators: [], counts,
  };
}

/** The seasons' own counts, by season, as the stand-in read answers for each window it is asked about. */
let seasonCounts: Partial<Record<SeasonId, WindowCount>>;
const CHRISTMAS_COUNT: WindowCount = {
  tours: 157, operators: 5, range: { minDays: 3, maxDays: 12, minPriceHkd: 3999 },
  destinations: [{ countryId: 'japan', regionId: null, tours: 20, operators: 2 }],
};

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.requestDb.mockReset().mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockReset().mockImplementation(async (_db, raw) => dataFor(raw));
  seasonCounts = { christmas: CHRISTMAS_COUNT, 'lunar-new-year': { tours: 1, operators: 1, range: { minDays: 4, maxDays: 4, minPriceHkd: 5280 } } };
  mocks.countToursInWindows.mockReset().mockImplementation(async (_db, _today, windows) =>
    (windows as SeasonWindow[]).map(w => seasonCounts[w.season] ?? { tours: 0, operators: 0 }));
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { consoleError.mockRestore(); });

const props = (locale: Locale, id: string, query: Record<string, string> = {}) =>
  ({ locale, params: Promise.resolve({ id }), searchParams: Promise.resolve(query) });
const metadata = (locale: Locale, id: string, query: Record<string, string> = {}) =>
  seasonPageMetadata(locale, Promise.resolve({ id }), Promise.resolve(query));

async function renderPage(locale: Locale, id: string, query: Record<string, string> = {}) {
  const element = await SeasonPage(props(locale, id, query));
  return render(<I18nProvider locale={locale}>{element}</I18nProvider>);
}

async function thrown(run: () => Promise<unknown>): Promise<{ digest?: string } | undefined> {
  try { await run(); } catch (err) { return err as { digest?: string }; }
  return undefined;
}

const NOT_FOUND = 'NEXT_HTTP_ERROR_FALLBACK;404';

it.each(['xmas', 'Christmas', 'christmas-2026', 'seasons', 'new-year', 'chinese-new-year', 'easter-2027'])('%s is a real 404, from the page and from its metadata, with no database read', async id => {
  for (const locale of ['zh-Hant', 'zh-Hans', 'en'] as const) {
    expect((await thrown(() => SeasonPage(props(locale, id))))?.digest).toBe(NOT_FOUND);
    expect((await thrown(() => metadata(locale, id)))?.digest).toBe(NOT_FOUND);
  }
  expect(mocks.requestDb).not.toHaveBeenCalled();
  expect(mocks.loadSearchPage).not.toHaveBeenCalled();
});

it('the departure window comes from the path and today: a from or to in the query is ignored, every other filter is read', async () => {
  await renderPage('zh-Hant', 'christmas', { from: '2027-01-01', to: '2027-01-05', dest: 'japan', dmin: '5' });
  expect(mocks.loadSearchPage).toHaveBeenCalledTimes(1);
  expect(mocks.loadSearchPage.mock.calls[0][1]).toEqual({ dest: 'japan', dmin: '5', from: '2026-12-19', to: '2026-12-27' });
  expect(mocks.loadSearchPage.mock.calls[0][2]).toBe('2026-11-22');
  // The season's own count: one read of the three seasons' current windows on the same today; and (task 78) one of the
  // twelve months' for the phone date sheet.
  expect(mocks.countToursInWindows.mock.calls).toEqual([
    [fakeDb, '2026-11-22', SEASON_IDS.map(id => seasonWindowNow(id))],
    [fakeDb, '2026-11-22', Array.from({ length: 12 }, (_, i) => monthWindow('2026-11-22', i))],
  ]);
  // The band's search box shows the destination from the query.
  expect(screen.getByRole('combobox')).toHaveValue('日本 → 全部地區');
});

/** The season's window on 22 November 2026 (this test's today). */
function seasonWindowNow(id: SeasonId): SeasonWindow {
  return seasonWindow(id, id === 'christmas' ? 2026 : 2027)!;
}

it.each([
  ['zh-Hant', 'christmas', '2026 聖誕旅行團', '12月19日至27日出發。現時列出 157 個旅行團，來自 5 間旅行社。'],
  ['zh-Hans', 'christmas', '2026 圣诞旅行团', '12月19日至27日出发。目前列出 157 个旅行团，来自 5 家旅行社。'],
  ['en', 'christmas', 'Christmas 2026 group tours', 'Departing 19 to 27 Dec. Listing 157 tours from 5 operators.'],
  ['zh-Hant', 'lunar-new-year', '2027 農曆新年旅行團', '2月3日至10日出發。現時列出 1 個旅行團，來自 1 間旅行社。'],
  ['zh-Hans', 'lunar-new-year', '2027 农历新年旅行团', '2月3日至10日出发。目前列出 1 个旅行团，来自 1 家旅行社。'],
  ['en', 'lunar-new-year', 'Lunar New Year 2027 group tours', 'Departing 3 to 10 Feb. Listing 1 tour from 1 operator.'],
  ['zh-Hant', 'easter', '2027 復活節旅行團', '3月24日至30日出發。現時沒有列出旅行團。'],
  ['en', 'easter', 'Easter 2027 group tours', 'Departing 24 to 30 Mar. No tours are listed right now.'],
] as const)('in %s, %s: the heading with the year, and the line with its days and its own count before any other filter', async (locale, id, heading, line) => {
  await renderPage(locale, id, { dmin: '30' });
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  expect(screen.getByText(line)).toBeInTheDocument();
  // No destination shortcuts: they would lead away from the season.
  expect(screen.queryByRole('navigation', { name: /旅行團最多|最多的目的地|most tours/ })).not.toBeInTheDocument();
});

describe('the clock (Hong Kong\'s today, injected)', () => {
  it.each([
    ['before the window', '2026-11-22', '2026 聖誕旅行團', '2026-12-19'],
    ['inside it', '2026-12-24', '2026 聖誕旅行團', '2026-12-19'],
    ['on its last day', '2026-12-27', '2026 聖誕旅行團', '2026-12-19'],
    ['the day after it: rolled forward to next year', '2026-12-28', '2027 聖誕旅行團', '2027-12-19'],
  ])('Christmas %s (%s): %s, searching from %s', async (_, today, heading, from) => {
    setToday(today);
    await renderPage('zh-Hant', 'christmas');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
    expect(mocks.loadSearchPage.mock.calls[0][1]).toMatchObject({ from });
    expect(mocks.loadSearchPage.mock.calls[0][2]).toBe(today);
  });

  it('a page made just before Hong Kong\'s midnight, seen just after it: the day that has come is no longer offered (lib/browser-today.ts)', async () => {
    vi.setSystemTime(new Date('2026-12-18T15:59:00Z')); // 23:59 on 18 Dec in Hong Kong: the page's today
    const firstDay: TourCardData = { ...tour, departures: [{ date: '2026-12-19', priceHkd: 7999 }, { date: '2026-12-26', priceHkd: 7999 }] };
    mocks.loadSearchPage.mockImplementation(async (_db, raw) => ({ ...dataFor(raw), tours: [firstDay], total: 1 }));
    const element = await SeasonPage(props('zh-Hant', 'christmas'));
    // The browser's own clock (not the tests' fixed one), now 00:20 on 19 Dec in Hong Kong.
    setBrowserTodayClockForTests(null);
    resetBrowserTodayCache();
    vi.setSystemTime(new Date('2026-12-18T16:20:00Z'));
    try {
      render(<I18nProvider locale="zh-Hant">{element}</I18nProvider>);
      const chips = screen.getAllByRole('link').map(a => a.textContent).filter(text => /^\d+\/\d+/.test(text ?? ''));
      expect(chips.some(text => text!.startsWith('12/26'))).toBe(true);
      expect(chips.some(text => text!.startsWith('12/19'))).toBe(false);
    } finally {
      resetBrowserTodayCache();
    }
  });

  it('an empty next season (Christmas 2027 seen in January): the usual no-tours state, noindex, and a description without numbers', async () => {
    setToday('2027-01-10');
    seasonCounts = {};
    mocks.loadSearchPage.mockImplementation(async (_db, raw) => ({ ...dataFor(raw), tours: [], total: 0 }));
    await renderPage('zh-Hant', 'christmas');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2027 聖誕旅行團');
    expect(screen.getByText('12月19日至27日出發。現時沒有列出旅行團。')).toBeInTheDocument();
    expect(screen.getByText('找不到符合條件的旅行團')).toBeInTheDocument();
    const meta = await metadata('zh-Hant', 'christmas');
    expect(meta.robots).toEqual({ index: false });
    expect(meta.description).toBe('2027年聖誕旅行團：12月19日至27日出發，比較香港多間旅行社的旅行團。報名請到旅行社自己的網站。');
  });

  it(`past the Lunar New Year table's end (${LUNAR_NEW_YEAR_LAST_YEAR}), that page is a 404, with no read; the others answer`, async () => {
    const last = seasonWindow('lunar-new-year', LUNAR_NEW_YEAR_LAST_YEAR)!;
    setToday(last.to);
    const lastPage = await renderPage('en', 'lunar-new-year');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`Lunar New Year ${LUNAR_NEW_YEAR_LAST_YEAR} group tours`);
    lastPage.unmount();
    mocks.loadSearchPage.mockClear();
    mocks.requestDb.mockClear();
    // The day after its last window.
    vi.setSystemTime(new Date(`${last.to}T04:00:00Z`).getTime() + 86_400_000);
    expect((await thrown(() => SeasonPage(props('en', 'lunar-new-year'))))?.digest).toBe(NOT_FOUND);
    expect((await thrown(() => metadata('en', 'lunar-new-year')))?.digest).toBe(NOT_FOUND);
    expect(mocks.requestDb).not.toHaveBeenCalled();
    await renderPage('en', 'easter');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`Easter ${LUNAR_NEW_YEAR_LAST_YEAR} group tours`);
  });
});

const languages = (id: string) => ({
  'zh-Hant': `https://example.invalid/seasons/${id}`, 'zh-Hans': `https://example.invalid/zh-hans/seasons/${id}`,
  en: `https://example.invalid/en/seasons/${id}`, 'x-default': `https://example.invalid/seasons/${id}`,
});

it.each([
  ['zh-Hant', 'christmas', '聖誕旅行團 2026 比較', '2026年聖誕旅行團：12月19日至27日出發，比較香港 5 間旅行社的 157 個旅行團，團費由 HK$3,999 起。報名請到旅行社自己的網站。', 'https://example.invalid/seasons/christmas', 'zh_HK'],
  ['zh-Hans', 'christmas', '圣诞旅行团 2026 比较', '2026年圣诞旅行团：12月19日至27日出发，比较香港 5 家旅行社的 157 个旅行团，团费 HK$3,999 起。报名请前往旅行社自己的网站。', 'https://example.invalid/zh-hans/seasons/christmas', 'zh_CN'],
  ['en', 'christmas', 'Christmas 2026 group tours compared', "Christmas 2026 group tours departing 19 to 27 Dec: 157 tours from 5 Hong Kong operators, from HK$3,999. Book on the operator's own website.", 'https://example.invalid/en/seasons/christmas', 'en_GB'],
  ['zh-Hant', 'lunar-new-year', '農曆新年旅行團 2027 比較', '2027年農曆新年旅行團：2月3日至10日出發，比較香港 1 間旅行社的 1 個旅行團，團費由 HK$5,280 起。報名請到旅行社自己的網站。', 'https://example.invalid/seasons/lunar-new-year', 'zh_HK'],
  // Simplified: 农历新年 in the title, 春节 in the description, as mainland readers search.
  ['zh-Hans', 'lunar-new-year', '农历新年旅行团 2027 比较', '2027年春节旅行团：2月3日至10日出发，比较香港 1 家旅行社的 1 个旅行团，团费 HK$5,280 起。报名请前往旅行社自己的网站。', 'https://example.invalid/zh-hans/seasons/lunar-new-year', 'zh_CN'],
  ['en', 'lunar-new-year', 'Lunar New Year 2027 group tours compared', "Lunar New Year 2027 group tours departing 3 to 10 Feb: 1 tour from 1 Hong Kong operator, from HK$5,280. Book on the operator's own website.", 'https://example.invalid/en/seasons/lunar-new-year', 'en_GB'],
] as const)('in %s, %s: titled with the season and year, described with its facts, canonical without the query string, the three languages and x-default, indexable', async (locale, id, title, description, canonical, ogLocale) => {
  // Filters in the address change nothing here: the canonical page is the bare one.
  expect(await metadata(locale, id, { dmin: '5', dest: 'japan', page: '2' })).toEqual({
    title, description,
    alternates: { canonical, languages: languages(id) },
    openGraph: { title: `${title} | 跟邊團`, description, siteName: '跟邊團', locale: ogLocale, type: 'website', images: [shareImage(makeT(locale))] },
    twitter: { card: 'summary_large_image' },
  });
});

it('a season with no tours now (Easter here) answers with the page, and is noindex', async () => {
  const meta = await metadata('en', 'easter');
  expect(meta.robots).toEqual({ index: false });
  expect(meta.description).toBe("Easter 2027 group tours departing 24 to 30 Mar, from several Hong Kong tour operators. Book on the operator's own website.");
  expect(meta.alternates?.canonical).toBe('https://example.invalid/en/seasons/easter');
});

it('the database being down: the heading and the message, noindex, and the breadcrumb trail still there', async () => {
  mocks.loadSearchPage.mockRejectedValue(new Error('connection refused'));
  const { container } = await renderPage('en', 'christmas');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Christmas 2026 group tours');
  expect(screen.getByRole('alert')).toHaveTextContent("Tours can't be loaded right now. Please try again later.");
  expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('season page'), expect.any(Error));
  expect(container.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
  expect((await metadata('en', 'christmas')).robots).toEqual({ index: false });
  // The season's count failing alone is the same failure.
  mocks.loadSearchPage.mockReset().mockImplementation(async (_db, raw) => dataFor(raw));
  mocks.countToursInWindows.mockRejectedValue(new Error('connection refused'));
  expect((await metadata('en', 'christmas')).robots).toEqual({ index: false });
});

it.each([
  ['zh-Hant', '', ['跟邊團', '旅行團目的地', '2026 聖誕旅行團']],
  ['zh-Hans', '/zh-hans', ['跟邊團', '旅行团目的地', '2026 圣诞旅行团']],
  ['en', '/en', ['跟邊團', 'Tour destinations', 'Christmas 2026 group tours']],
] as const)('in %s: one breadcrumb trail, the home page, the destinations index, then this page under its heading; no other block', async (locale, prefix, names) => {
  const { container } = await renderPage(locale, 'christmas', { dmin: '5', page: '2' });
  const blocks = [...container.querySelectorAll('script[type="application/ld+json"]')];
  expect(blocks).toHaveLength(1);
  expect(JSON.parse(blocks[0].textContent!)).toEqual({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: names[0], item: `https://example.invalid${prefix}` },
      { '@type': 'ListItem', position: 2, name: names[1], item: `https://example.invalid${prefix}/tours` },
      { '@type': 'ListItem', position: 3, name: names[2], item: `https://example.invalid${prefix}/seasons/christmas` },
    ],
  });
});

it.each([
  ['zh-Hant', '/seasons/christmas?dest=japan&page=2', '/seasons/christmas?dest=japan&size=48'],
  ['zh-Hans', '/zh-hans/seasons/christmas?dest=japan&page=2', '/zh-hans/seasons/christmas?dest=japan&size=48'],
  ['en', '/en/seasons/christmas?dest=japan&page=2', '/en/seasons/christmas?dest=japan&size=48'],
] as const)('in %s paging and the rows-per-page choice stay on the season\'s page, with no from or to in the address', async (locale, next, size) => {
  await renderPage(locale, 'christmas', { dest: 'japan' });
  const hrefs = screen.getAllByRole('link').map(a => a.getAttribute('href'));
  expect(hrefs).toContain(next);
  expect(hrefs).toContain(size);
  expect(hrefs.filter(h => /[?&](from|to)=/.test(h ?? ''))).toEqual([]);
});

it.each([
  ['zh-Hant', '清除所有篩選', '/seasons/christmas'], ['zh-Hans', '清除所有筛选条件', '/zh-hans/seasons/christmas'], ['en', 'Clear all filters', '/en/seasons/christmas'],
] as const)('in %s, when the filters match nothing, "clear all filters" keeps the season', async (locale, clear, href) => {
  mocks.loadSearchPage.mockImplementation(async (_db, raw) => ({ ...dataFor(raw), tours: [], total: 0 }));
  await renderPage(locale, 'christmas', { dmin: '30' });
  expect(screen.getByRole('link', { name: clear })).toHaveAttribute('href', href);
});

it('the departure dates show the season\'s days as chosen', async () => {
  await renderPage('zh-Hant', 'christmas');
  expect(screen.getByRole('button', { name: '出發日期：12/19 – 12/27' })).toBeInTheDocument();
});

it.each(['zh-Hant', 'zh-Hans', 'en'] as const)('in %s every season\'s description, at the largest plausible numbers and across two months, is one or two sentences within 80 full-width characters', locale => {
  const t = makeT(locale);
  // Easter 2029 crosses into April: the longest days ('28 Mar to 3 Apr').
  const windows = SEASON_IDS.map(id => ({ ...seasonWindow(id, 2029)!, from: '2029-03-28', to: '2029-04-03' }));
  for (const window of windows) {
    for (const count of [{ tours: 99999, operators: 99, range: { minDays: 1, maxDays: 60, minPriceHkd: 999999 } }, null]) {
      const description = seasonDescription(t, window, count);
      expect(fullWidth(description), description).toBeLessThanOrEqual(80);
      expect(sentences(description).length, description).toBeLessThanOrEqual(2);
    }
  }
});

it('the Traditional Chinese Lunar New Year description carries both 農曆新年 and 新年旅行團', async () => {
  const { description } = await metadata('zh-Hant', 'lunar-new-year');
  expect(description).toContain('農曆新年');
  expect(description).toContain('新年旅行團');
});


describe('the band\'s rows on a season\'s page (task 69, drawing W3)', () => {
  /** A row's boxes as [accessible name or text, address or null when it is no link]. */
  const row = (label: string) =>
    [...within(screen.getByRole('navigation', { name: label })).getByRole('list').querySelectorAll('li > a, li > span')]
      .map(el => [el.getAttribute('aria-label') ?? el.textContent, el.tagName === 'A' ? el.getAttribute('href') : null]);

  it.each([
    ['zh-Hant', '熱門目的地', '節日旅行團', [['日本 20 團', '/seasons/christmas?dest=japan']], [['聖誕 157 團，已選取，按此取消', '/'], ['農曆新年 1 團', '/seasons/lunar-new-year']]],
    ['zh-Hans', '热门目的地', '节日旅行团', [['日本 20 团', '/zh-hans/seasons/christmas?dest=japan']], [['圣诞 157 团，已选取，按此取消', '/zh-hans'], ['农历新年 1 团', '/zh-hans/seasons/lunar-new-year']]],
    ['en', 'Popular destinations', 'Holiday tours', [['Japan 20 tours', '/en/seasons/christmas?dest=japan']], [['Christmas, 157 tours, selected: press to remove', '/en'], ['Lunar New Year 1 tour', '/en/seasons/lunar-new-year']]],
  ] as const)('in %s: both rows; the destinations counted in the season and keeping it; the season chosen, pressing it leaves', async (locale, where, when, destinations, seasons) => {
    await renderPage(locale, 'christmas');
    expect(row(where)).toEqual(destinations.map(x => [...x]));
    expect(row(when)).toEqual(seasons.map(x => [...x]));
  });

  it('with a destination chosen: the heading and line name and count the combination; un-choosing either keeps the other, and the other filters', async () => {
    await renderPage('zh-Hant', 'christmas', { dest: 'japan', dmin: '5', sort: 'days', page: '3' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2026 聖誕日本旅行團');
    expect(screen.getByText('12月19日至27日出發。現時列出 20 個旅行團，來自 2 間旅行社。')).toBeInTheDocument();
    expect(row('節日旅行團')[0]).toEqual(['聖誕 20 團，已選取，按此取消', '/tours/japan?dmin=5&sort=days']);
    // Japan has no region pages in these counts: its box chosen first (pressing it keeps the season).
    expect(row('熱門目的地')[0]).toEqual(['日本 20 團，已選取，按此取消', '/seasons/christmas?dmin=5&sort=days']);
    // The title, description and canonical stay the season's; the breadcrumb trail too.
    const meta = await metadata('zh-Hant', 'christmas', { dest: 'japan' });
    expect(meta.title).toBe('聖誕旅行團 2026 比較');
    expect(meta.alternates?.canonical).toBe('https://example.invalid/seasons/christmas');
  });

  it.each([
    ['zh-Hans', '2026 圣诞日本旅行团'], ['en', 'Christmas 2026 group tours to Japan'],
  ] as const)('in %s, the heading with a destination chosen: %s', async (locale, heading) => {
    await renderPage(locale, 'christmas', { dest: 'japan' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  });

  it('an empty season\'s page shows its own box (0) chosen, the way out; destinations with nothing in it are faded', async () => {
    await renderPage('en', 'easter');
    expect(row('Holiday tours')).toEqual([
      ['Christmas 157 tours', '/en/seasons/christmas'], ['Lunar New Year 1 tour', '/en/seasons/lunar-new-year'],
      ['Easter, 0 tours, selected: press to remove', '/en'],
    ]);
    expect(row('Popular destinations')).toEqual([['Japan 0 tours', null]]);
  });

  it('the seasons cannot be read: the page\'s usual failure (the message, noindex), and no rows', async () => {
    mocks.countToursInWindows.mockRejectedValue(new Error('connection refused'));
    await renderPage('zh-Hant', 'christmas');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '節日旅行團' })).toBeNull();
    expect((await metadata('zh-Hant', 'christmas')).robots).toEqual({ index: false });
  });
});
