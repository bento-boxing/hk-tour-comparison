import { it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isIsoDate } from '@hktours/core';
import type { Db, TourCardData } from '@hktours/db/read';
import styles from './search-page.module.css';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { I18nProvider } from '../../lib/i18n-client';
import type { Locale } from '../../lib/i18n';
import type { SearchPageData } from '../../lib/search-page-data';
import type { DestinationCounts } from '@hktours/db/read';

const mocks = vi.hoisted(() => ({
  requestDb: vi.fn<() => Promise<Db>>(),
  loadSearchPage: vi.fn<(db: Db, raw: Record<string, string | string[] | undefined>, today: string, locale?: string, reads?: unknown) => Promise<SearchPageData>>(),
  /** Stands in for the reads through Next's data cache (lib/cached-reads.ts). */
  cachedReads: { name: 'cachedReads' },
}));
vi.mock('../../lib/db', () => ({ requestDb: mocks.requestDb }));
vi.mock('../../lib/search-page-data', () => ({ loadSearchPage: mocks.loadSearchPage, cachedReads: mocks.cachedReads }));
vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()), // the real unstable_rethrow
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const { SearchPage, searchPageMetadata } = await import('./search-page');
const { DestinationPage } = await import('./destination-page');

const fakeDb = {} as Db;
const ERROR = '暫時未能載入資料，請稍後再試。';
// The page takes today from the clock (todayInHongKong()) and the cards show the fixture dates
// against it, so the clock is pinned to a day before them.
beforeAll(() => { vi.setSystemTime(new Date('2026-11-12T04:00:00Z')); }); // 12:00 in Hong Kong
afterAll(() => { vi.useRealTimers(); });

const tour: TourCardData = {
  key: 'egl:KIX5', operatorId: 'egl', url: 'https://example.test/egl/KIX5', title: 'KIX5', days: 5, nights: 4,
  stops: [{ countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' }],
  start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
  fromPriceHkd: 7999, windowPriceHkd: 7999, fallbackPriceHkd: 7999,
  departures: [{ date: '2026-12-18', priceHkd: 7999 }], priceChange: null, lastUpdated: '2026-11-11T19:10:00Z',
};

/** Invented counts: 40 tours from 3 operators in all, Japan 32 from 3, Kansai 30 from 2, Kanto 5 from 1. */
const counts: DestinationCounts = {
  all: { tours: 40, operators: 3 },
  destinations: [
    { countryId: 'japan', regionId: null, tours: 32, operators: 3 },
    { countryId: 'japan', regionId: 'japan-kansai', tours: 30, operators: 2 },
    { countryId: 'japan', regionId: 'japan-kanto', tours: 5, operators: 1 },
  ],
};

const data: SearchPageData = {
  state: { filters: { destination: { countryId: 'japan', regionId: 'japan-kansai' } }, sort: 'days', page: 1 },
  tours: [tour], total: 30,
  operators: [{ id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: null }],
  filterOperators: [{ id: 'jetour', nameZh: '捷旅', nameEn: 'Jetour', color: '#ee7b06', lastGoodRunAt: '2026-11-11T19:10:00Z' }],
  counts,
};
/** The same page on '/', without a destination. */
const homeData: SearchPageData = { ...data, state: { filters: {}, sort: 'days', page: 1 } };

/**
 * The layout gives the client components the same locale (the address's) as the server page gets. An address with
 * `dest` is rendered as that destination's page (/tours/<dest>), the address it has now; the rest as the search page.
 */
async function renderPage(params: Record<string, string | string[] | undefined>, locale: Locale = 'zh-Hant') {
  const { dest, ...rest } = params;
  const element = typeof dest === 'string'
    ? await DestinationPage({ locale, params: Promise.resolve({ id: dest }), searchParams: Promise.resolve(rest) })
    : await SearchPage({ locale, searchParams: Promise.resolve(params) });
  return render(<I18nProvider locale={locale}>{element}</I18nProvider>);
}

/** What a page threw (Next.js's redirect and not-found are thrown errors), or undefined. */
async function thrown(run: () => Promise<unknown>): Promise<{ digest?: string } | undefined> {
  try { await run(); } catch (err) { return err as { digest?: string }; }
  return undefined;
}

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.requestDb.mockReset();
  mocks.loadSearchPage.mockReset();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { consoleError.mockRestore(); });

it('loads the page from the address and lays it out top to bottom', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(data);
  const { container } = await renderPage({ dest: 'japan-kansai', sort: 'days' });

  expect(mocks.loadSearchPage).toHaveBeenCalledTimes(1);
  const [db, raw, today] = mocks.loadSearchPage.mock.calls[0];
  expect(db).toBe(fakeDb);
  expect(raw).toEqual({ dest: 'japan-kansai', sort: 'days' });
  expect(isIsoDate(today)).toBe(true);

  const search = screen.getByRole('combobox', { name: '輸入國家、地區或城市' });
  expect(search).toHaveValue('日本 → 關西');
  const panels = screen.getByRole('button', { name: '按國家選擇' });
  const destPill = screen.getByRole('button', { name: '清除目的地：日本 → 關西' });
  const sortPill = screen.getByRole('button', { name: '排序：日數 短→長' });
  const count = screen.getByText('共 30 個旅行團');
  const card = screen.getByRole('article');
  const next = screen.getByRole('link', { name: '下一頁' });
  const inOrder = [search, panels, destPill, sortPill, count, card, next];
  for (let i = 1; i < inOrder.length; i++) {
    expect(inOrder[i - 1].compareDocumentPosition(inOrder[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
  expect(screen.getByRole('button', { name: '加入行程 ＋' })).toBeInTheDocument();
  expect(next).toHaveAttribute('href', '/tours/japan-kansai?sort=days&page=2');
  expect(container.textContent).not.toContain(ERROR);
  expect(consoleError).not.toHaveBeenCalled();
});

it.each([
  ['en', 'Japan → Kansai', 'Clear destination: Japan → Kansai', '30 tours', 'Next', '東瀛遊 (EGL Tours)', 'Osaka', '/en/tours/japan-kansai'],
  ['zh-Hans', '日本 → 关西', '清除目的地：日本 → 关西', '共 30 个旅行团', '下一页', '東瀛遊', '大阪', '/zh-hans/tours/japan-kansai'],
] as const)('in %s, the server text, the client text and the place names all follow the page\'s language', async (locale, dest, destPill, count, next, operator, city, home) => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(data);
  const { container } = await renderPage({ dest: 'japan-kansai', sort: 'days' }, locale);
  expect(screen.getByRole('combobox')).toHaveValue(dest);
  expect(screen.getByRole('button', { name: destPill })).toBeInTheDocument();
  expect(screen.getByText(count)).toBeInTheDocument();
  // The Pager: server text, and its link in the page's language.
  expect(screen.getByRole('link', { name: next })).toHaveAttribute('href', `${home}?sort=days&page=2`);
  const card = screen.getByRole('article');
  expect(within(card).getByText(operator)).toBeInTheDocument();
  expect(within(card).getByRole('heading')).toHaveTextContent(city);
  expect(container.textContent).not.toMatch(/關西|個旅行團/);
});

it.each(['zh-Hant', 'zh-Hans', 'en'] as const)('passes the language (%s) to the loader, for the destination sort', async locale => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(data);
  await renderPage({ sort: 'destination' }, locale);
  expect(mocks.loadSearchPage.mock.calls[0][3]).toBe(locale);
});

it('reads the database through the cached reads', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(data);
  await renderPage({});
  expect(mocks.loadSearchPage.mock.calls[0][4]).toBe(mocks.cachedReads);
});

it('the server text is in English on an English page (the error message)', async () => {
  mocks.requestDb.mockRejectedValue(new Error('DATABASE_URL is not set'));
  await renderPage({}, 'en');
  expect(screen.getByRole('alert')).toHaveTextContent("Tours can't be loaded right now. Please try again later.");
});

it('shows the error message, and logs the cause, when DATABASE_URL is missing', async () => {
  mocks.requestDb.mockRejectedValue(new Error('DATABASE_URL is not set: the website needs it to read tours from the database.'));
  await renderPage({});
  expect(screen.getByText(ERROR)).toBeInTheDocument();
  expect(screen.queryByRole('article')).toBeNull();
  expect(mocks.loadSearchPage).not.toHaveBeenCalled();
  expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('search page'), expect.objectContaining({ message: expect.stringContaining('DATABASE_URL') }));
});

it('shows the error message when the database is unreachable', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' }));
  const { container } = await renderPage({ dest: 'japan-kansai' });
  expect(screen.getByText(ERROR)).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/ECONNREFUSED|5432|at /);
  expect(consoleError).toHaveBeenCalledTimes(1);
});

it.each([
  ['the connection timeout', Object.assign(new Error('Connection terminated due to connection timeout'), {})],
  ['the query timeout (pg, client side)', new Error('Query read timeout')],
  // Only if a statement_timeout is set on the database role (an optional safeguard).
  ['a server-side statement timeout', Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' })],
])('shows the error message when the database hits %s', async (_, err) => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockRejectedValue(err);
  const { container } = await renderPage({});
  expect(screen.getByText(ERROR)).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/timeout|57014/);
  expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('search page'), err);
});

it('passes the same today to the filter bar as to the loader', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue({ ...data, state: { filters: { dateFrom: '2099-12-01' }, sort: 'price', page: 1 } });
  await renderPage({});
  // 2099 is never the current year, so the pill shows it.
  expect(screen.getByRole('button', { name: '出發日期：2099/12/1 –' })).toBeInTheDocument();
});

it('a page past the last says so neutrally, with the link back to page 1, not the no-match message', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue({ ...data, state: { ...data.state, page: 9 }, tours: [], total: 30 });
  await renderPage({ dest: 'japan-kansai', sort: 'days', page: '9' });
  expect(screen.getByText('這一頁沒有內容。')).toBeInTheDocument();
  expect(screen.queryByText('找不到符合條件的旅行團')).toBeNull();
  expect(screen.getByRole('link', { name: '回到第 1 頁' })).toHaveAttribute('href', '/tours/japan-kansai?sort=days');
});

it('the filter bar offers filterOperators; the cards look operators up in the full list', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(data);
  await renderPage({});
  expect(within(screen.getByRole('article')).getByText('東瀛遊')).toBeInTheDocument(); // egl's card, from `operators`
  await userEvent.setup().click(screen.getByRole('button', { name: '旅行社：全部' }));
  const dialog = screen.getByRole('dialog', { name: '旅行社' });
  expect(within(dialog).getAllByRole('checkbox').map(box => box.parentElement?.textContent)).toEqual(['捷旅']);
});

// The 按國家選擇 panel hangs off the search row on phones (DestinationPanels.module.css), so the button must sit
// inside that row and the row must be positioned.
it('the 按國家選擇 button sits in the positioned search row, with the search box', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(data);
  await renderPage({});
  const row = screen.getByRole('button', { name: '按國家選擇' }).closest(`.${styles.searchRow}`);
  expect(row).not.toBeNull();
  expect(row).toContainElement(screen.getByRole('combobox', { name: '輸入國家、地區或城市' }));
  const css = readFileSync(join(__dirname, 'search-page.module.css'), 'utf8').replace(/\s+/g, ' ');
  expect(css).toMatch(/\.searchRow \{[^}]*position: relative;/);
});

const languages = {
  'zh-Hant': 'https://ganbintuen.com',
  'zh-Hans': 'https://ganbintuen.com/zh-hans',
  en: 'https://ganbintuen.com/en',
  'x-default': 'https://ganbintuen.com',
};

it.each([
  ['zh-Hant', 'https://ganbintuen.com', '集合多間香港旅行社的旅行團，可按出發日期、日數、目的地及價錢篩選。報名請到旅行社自己的網站。', 'zh_HK'],
  ['zh-Hans', 'https://ganbintuen.com/zh-hans', '汇集多家香港旅行社的旅行团，可按出发日期、天数、目的地和价格筛选。报名请前往旅行社自己的网站。', 'zh_CN'],
  ['en', 'https://ganbintuen.com/en', "Group tours from several Hong Kong tour operators in one place. Filter by departure date, length, destination and price, then book on the operator's own website.", 'en_GB'],
] as const)('in %s: the page names its own language\'s address canonical, without the query string, lists the three languages and x-default, with Open Graph in that language', async (locale, canonical, description, ogLocale) => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(homeData);
  // A filtered or paged address (/en?dmin=5&page=2) gets this same answer.
  expect(await searchPageMetadata(locale, Promise.resolve({ dmin: '5', page: '2' }))).toEqual({
    alternates: { canonical, languages },
    openGraph: { title: '跟邊團', description, siteName: '跟邊團', locale: ogLocale, type: 'website' },
  });
});

it('gives no og:url, so a shared filtered search (/?dmin=5) keeps its own address on Facebook and LinkedIn', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(homeData);
  const { openGraph } = await searchPageMetadata('zh-Hant', Promise.resolve({ dmin: '5' }));
  expect(openGraph).toBeDefined();
  expect(openGraph).not.toHaveProperty('url');
});

it('when the tours cannot be read, the page is marked noindex, so an outage is never indexed as the page', async () => {
  mocks.requestDb.mockRejectedValue(new Error('DATABASE_URL is not set'));
  expect(await searchPageMetadata('zh-Hant', Promise.resolve({}))).toMatchObject({ robots: { index: false } });
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockRejectedValue(new Error('connection refused'));
  expect(await searchPageMetadata('en', Promise.resolve({}))).toMatchObject({ robots: { index: false } });
  mocks.loadSearchPage.mockResolvedValue(homeData);
  expect(await searchPageMetadata('en', Promise.resolve({}))).not.toHaveProperty('robots');
});

it.each([
  ['zh-Hant', '比較香港旅行團', '現時列出 40 個旅行團，來自 3 間旅行社。', '按目的地瀏覽', '/tours'],
  ['zh-Hans', '比较香港旅行团', '目前列出 40 个旅行团，来自 3 家旅行社。', '按目的地浏览', '/zh-hans/tours'],
  ['en', 'Compare Hong Kong group tours', 'Listing 40 tours from 3 operators.', 'Browse by destination', '/en/tours'],
] as const)('in %s the search page has its heading, the line of real counts, and a link to the destinations index', async (locale, heading, line, browse, index) => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(homeData);
  await renderPage({}, locale);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  expect(screen.getByText(line, { exact: false })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: browse })).toHaveAttribute('href', index);
  // The heading comes before the search box.
  expect(screen.getByRole('heading', { level: 1 }).compareDocumentPosition(screen.getByRole('combobox')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it.each([
  ['zh-Hant', { dest: 'japan', dmin: '5' }, '/tours/japan?dmin=5'],
  ['zh-Hans', { dest: 'japan', dmin: '5', sort: 'days', page: '2' }, '/zh-hans/tours/japan?dmin=5&sort=days&page=2'],
  ['en', { dest: 'japan' }, '/en/tours/japan'],
  ['en', { dest: 'china-beijing', op: 'egl', ex: 'korea' }, '/en/tours/china-beijing?op=egl'],
  // The only region of its country: to the country's page, not to the region's noindex copy.
  ['zh-Hant', { dest: 'france-france', dmin: '5' }, '/tours/france?dmin=5'],
  ['zh-Hans', { dest: 'france-france' }, '/zh-hans/tours/france'],
] as const)('in %s an old address with dest= is moved permanently (308) to the destination\'s page with the other filters, before any read', async (locale, params, href) => {
  const err = await thrown(() => SearchPage({ locale, searchParams: Promise.resolve(params) }));
  expect(err?.digest).toBe(`NEXT_REDIRECT;replace;${href};308;`);
  expect(mocks.requestDb).not.toHaveBeenCalled();
  expect(mocks.loadSearchPage).not.toHaveBeenCalled();
});

it.each([['nonsense'], ['china-central'], ['Japan'], ['%2F%2Fevil.example']])('an old address whose dest is %s names no destination: no redirect, and the dest is ignored as before', async dest => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(homeData);
  const element = await SearchPage({ locale: 'zh-Hant', searchParams: Promise.resolve({ dest: decodeURIComponent(dest), dmin: '5' }) });
  render(<I18nProvider locale="zh-Hant">{element}</I18nProvider>);
  expect(mocks.loadSearchPage.mock.calls[0][1]).toEqual({ dmin: '5' });
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('比較香港旅行團');
});

it('on the error, the search page keeps its heading above the message', async () => {
  mocks.requestDb.mockRejectedValue(new Error('DATABASE_URL is not set'));
  await renderPage({});
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('比較香港旅行團');
  expect(screen.getByRole('alert')).toHaveTextContent(ERROR);
});
