import { it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isIsoDate } from '@hktours/core';
import type { Db, TourCardData } from '@hktours/db/read';
import band from './search-band.module.css';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { I18nProvider } from '../../lib/i18n-client';
import type { Locale } from '../../lib/i18n';
import type { SearchPageData } from '../../lib/search-page-data';
import type { DestinationCounts } from '@hktours/db/read';

/** The tour rows of the list (an ARIA table): the rows with cells, not its visually hidden header row. */
const tourRows = () => screen.queryAllByRole('row').filter(row => within(row).queryAllByRole('cell').length > 0);
/** The one tour row on the page. */
const oneRow = () => { const rows = tourRows(); expect(rows).toHaveLength(1); return rows[0]; };


const mocks = vi.hoisted(() => ({
  requestDb: vi.fn<() => Promise<Db>>(),
  storedDb: vi.fn<() => Promise<Db>>(),
  loadSearchPage: vi.fn<(db: Db, raw: Record<string, string | string[] | undefined>, today: string, locale?: string, reads?: unknown) => Promise<SearchPageData>>(),
  /** Stands in for the reads through Next's data cache (lib/cached-reads.ts). */
  cachedReads: { name: 'cachedReads' },
}));
vi.mock('../../lib/db', () => ({ requestDb: mocks.requestDb, storedDb: mocks.storedDb }));
vi.mock('../../lib/search-page-data', () => ({ loadSearchPage: mocks.loadSearchPage, cachedReads: mocks.cachedReads }));
vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()), // the real unstable_rethrow
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const { SearchPage, searchPageMetadata, StoredSearchPage, storedSearchPageMetadata } = await import('./search-page');
const { DestinationPage } = await import('./destination-page');

const fakeDb = {} as Db;
const ERROR = '暫時未能載入資料，請稍後再試。';
// The page takes today from the clock (todayInHongKong()) and the rows show the fixture dates
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
  // The stored copy's handle fails unless a test gives it a database: no other page may use it.
  mocks.storedDb.mockReset().mockRejectedValue(new Error('storedDb used by a per-request page'));
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

  // The band (heading, search box, country button, shortcuts), the filter row, the rows, then under them the
  // rows-per-page choice, the count and the pager.
  const heading = screen.getByRole('heading', { level: 1 });
  const search = screen.getByRole('combobox', { name: '輸入國家、地區或城市' });
  expect(search).toHaveValue('日本 → 關西');
  const panels = screen.getByRole('button', { name: '按國家選擇' });
  const shortcuts = screen.getByRole('navigation', { name: '旅行團最多的目的地' });
  const destPill = screen.getByRole('button', { name: '清除目的地：日本 → 關西' });
  const sortPill = screen.getByRole('button', { name: '排序：日數 短→長' });
  const card = oneRow();
  const sizes = screen.getByRole('group', { name: '每頁顯示' });
  const count = screen.getByText('第 1–24 個，共 30 個旅行團');
  const next = screen.getByRole('link', { name: '下一頁' });
  // Then when the data was last updated (no operator in this data has run: no line). See ListFooter's tests.
  const inOrder = [heading, search, panels, shortcuts, destPill, sortPill, card, sizes, count, next];
  for (let i = 1; i < inOrder.length; i++) {
    expect(inOrder[i - 1].compareDocumentPosition(inOrder[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
  expect(screen.getByRole('button', { name: '加入行程 +' })).toBeInTheDocument();
  expect(next).toHaveAttribute('href', '/tours/japan-kansai?sort=days&page=2');
  expect(container.textContent).not.toContain(ERROR);
  expect(consoleError).not.toHaveBeenCalled();
});

it.each([
  ['en', 'Japan → Kansai', 'Clear destination: Japan → Kansai', '1–24 of 30 tours', 'Next', 'EGL Tours', 'Osaka', '/en/tours/japan-kansai'],
  ['zh-Hans', '日本 → 关西', '清除目的地：日本 → 关西', '第 1–24 个，共 30 个旅行团', '下一页', '東瀛遊', '大阪', '/zh-hans/tours/japan-kansai'],
] as const)('in %s, the server text, the client text and the place names all follow the page\'s language', async (locale, dest, destPill, count, next, operator, city, home) => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(data);
  const { container } = await renderPage({ dest: 'japan-kansai', sort: 'days' }, locale);
  expect(screen.getByRole('combobox')).toHaveValue(dest);
  expect(screen.getByRole('button', { name: destPill })).toBeInTheDocument();
  expect(screen.getByText(count)).toBeInTheDocument();
  // The Pager: server text, and its link in the page's language.
  expect(screen.getByRole('link', { name: next })).toHaveAttribute('href', `${home}?sort=days&page=2`);
  const card = oneRow();
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
  expect(tourRows()).toHaveLength(0);
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

it('the filter bar offers filterOperators; the rows look operators up in the full list', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(data);
  await renderPage({});
  expect(within(oneRow()).getByText('東瀛遊')).toBeInTheDocument(); // egl's card, from `operators`
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
  const row = screen.getByRole('button', { name: '按國家選擇' }).closest(`.${band.searchRow}`);
  expect(row).not.toBeNull();
  expect(row).toContainElement(screen.getByRole('combobox', { name: '輸入國家、地區或城市' }));
  const css = readFileSync(join(__dirname, 'search-band.module.css'), 'utf8').replace(/\s+/g, ' ');
  expect(css).toMatch(/\.searchRow \{[^}]*position: relative;/);
});

/** search-band.module.css's rules: { media: { selector: declarations } } ('' outside any @media). */
function bandRules(): Record<string, Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, Record<string, string>>> = {};
  const source = readFileSync(join(__dirname, 'search-band.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const read = (text: string, media: string) => {
    for (const m of text.matchAll(/([^{}]+)\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
      const prelude = m[1].trim().replace(/\s+/g, ' ');
      if (prelude.startsWith('@media')) { read(m[2], prelude.slice(6).trim()); continue; }
      for (const selector of prelude.split(',').map(s => s.trim())) {
        const d = ((out[media] ??= {})[selector] ??= {});
        for (const part of m[2].split(';')) {
          const colon = part.indexOf(':');
          if (colon > 0) d[part.slice(0, colon).trim()] = part.slice(colon + 1).trim().replace(/\s+/g, ' ');
        }
      }
    }
  };
  read(source, '');
  return out;
}

// The owner's drawing E1: the destinations with the most tours are boxes, the index after them a text link.
it('the band\'s shortcuts are boxes (ink, the name bold, its count lighter and smaller); the index stays a text link', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(homeData);
  await renderPage({});
  const links = within(screen.getByRole('navigation', { name: '旅行團最多的目的地' })).getAllByRole('link');
  for (const link of links.slice(0, -1)) {
    expect(link).toHaveClass(band.shortcut);
    expect(link.querySelector(`.${band.count}`)).not.toBeNull();
  }
  expect(links.at(-1)).toHaveClass(band.all);
  expect(links.at(-1)).not.toHaveClass(band.shortcut);
  const rules = bandRules();
  // The header's ink and text, as the band's 按國家選擇 button (lib/theme.test.ts checks both themes' contrast).
  expect(rules['']['.shortcut']).toMatchObject({
    background: 'var(--header-bg)', color: 'var(--header-text)', 'border-radius': '6px', 'font-weight': '700',
    'text-decoration': 'none', 'min-height': '32px',
  });
  expect(rules['']['.count']).toMatchObject({ 'font-weight': '500', 'font-size': '13px' });
  expect(Number.parseInt(rules['']['.shortcut']['font-size'], 10)).toBeGreaterThan(13);
  // The index: no box, underlined.
  expect(rules['']['.all']).not.toHaveProperty('background');
  expect(rules['']['.all']['text-decoration']).toBe('underline');
  // The words in a box keep 12px from its sides (the drawing's padding), so a name never touches its box's edge.
  const [, side] = rules['']['.shortcut'].padding.split(' ').map(v => Number.parseFloat(v));
  expect(side).toBeGreaterThanOrEqual(12);
  // On a line of its own, the index starts where the boxes do: no padding before its words.
  expect(Number.parseFloat(rules['']['.all'].padding.split(' ').at(-1)!)).toBe(0);
  // They wrap onto more lines, never scroll sideways; 44px to touch on a phone.
  expect(rules['']['.shortcutList']).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap' });
  expect(Object.values(rules).flatMap(r => Object.values(r)).some(d => /auto|scroll/.test(d['overflow-x'] ?? d.overflow ?? ''))).toBe(false);
  expect(rules['(max-width: 639px)']['.shortcut']).toMatchObject({ 'min-height': '44px' });
  expect(rules['(max-width: 639px)']['.all']).toMatchObject({ 'min-height': '44px' });
});

const languages = {
  'zh-Hant': 'https://example.invalid',
  'zh-Hans': 'https://example.invalid/zh-hans',
  en: 'https://example.invalid/en',
  'x-default': 'https://example.invalid',
};

it.each([
  ['zh-Hant', 'https://example.invalid', '集合多間香港旅行社的旅行團，可按出發日期、日數、目的地及價錢篩選。報名請到旅行社自己的網站。', 'zh_HK'],
  ['zh-Hans', 'https://example.invalid/zh-hans', '汇集多家香港旅行社的旅行团，可按出发日期、天数、目的地和价格筛选。报名请前往旅行社自己的网站。', 'zh_CN'],
  ['en', 'https://example.invalid/en', "Group tours from several Hong Kong tour operators in one place. Filter by departure date, length, destination and price, then book on the operator's own website.", 'en_GB'],
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

it('under the pager, when the data was last updated; rows carry the render\'s time for their old-data warning', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  const ranAt = '2026-11-08T18:30:00Z'; // 02:30 on 9 Nov in Hong Kong: older than 36 hours on 12 Nov (the clock)
  mocks.loadSearchPage.mockResolvedValue({
    ...data, operators: [{ ...data.operators[0], lastGoodRunAt: ranAt }], tours: [{ ...tour, lastUpdated: ranAt }],
  });
  await renderPage({ dest: 'japan-kansai', sort: 'days' });
  const note = screen.getByText('資料更新：11月9日 · 各旅行社每晚更新一次 · 價錢及出發日期以旅行社網站為準');
  expect(screen.getByRole('link', { name: '下一頁' }).compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(oneRow()).getAllByText('資料為 11月9日')).toHaveLength(2);
});

it.each([
  ['zh-Hant', '三間旅行社，一次過比較', '現有 40 個旅行團 · 報名請到旅行社自己的網站', '想去邊？輸入國家、地區或城市', '旅行團最多的目的地', '所有目的地 →', '/tours'],
  ['zh-Hans', '三家旅行社，一次比较', '现有 40 个旅行团 · 报名请前往旅行社自己的网站', '想去哪里？输入国家、地区或城市', '旅行团最多的目的地', '所有目的地 →', '/zh-hans/tours'],
  ['en', 'Three tour operators, compared in one place', "40 tours listed now · book on the operator's own website", 'Where to? Enter a country, region or city', 'Destinations with the most tours', 'All destinations →', '/en/tours'],
] as const)('in %s the home page\'s gold band: the headline and line from the live counts, the search box, the shortcuts and the index', async (locale, heading, line, placeholder, shortcutsName, all, index) => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  // Korea and its Seoul region too: a region with more tours than Korea (Kansai, 30) is still not offered.
  const korea = [{ countryId: 'korea', regionId: null, tours: 8, operators: 1 }, { countryId: 'korea', regionId: 'korea-seoul', tours: 8, operators: 1 }];
  mocks.loadSearchPage.mockResolvedValue({ ...homeData, counts: { ...counts, destinations: [...counts.destinations, ...korea] } });
  await renderPage({}, locale);
  // 3 operators and 40 tours: counts.all, from the read the page already makes.
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  expect(screen.getByText(line)).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', placeholder);
  // The shortcuts: the countries with the most tours, most first (never a country beside its own regions), then
  // the index.
  const shortcuts = within(screen.getByRole('navigation', { name: shortcutsName })).getAllByRole('link');
  expect(shortcuts.map(a => a.getAttribute('href'))).toEqual([
    ...['/tours/japan', '/tours/korea'].map(path => (index === '/tours' ? path : `${index.slice(0, -'/tours'.length)}${path}`)),
    index,
  ]);
  expect(shortcuts.at(-1)).toHaveTextContent(all);
  // The heading comes before the search box.
  expect(screen.getByRole('heading', { level: 1 }).compareDocumentPosition(screen.getByRole('combobox')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('the headline\'s numbers are the live ones: one operator, twelve, twenty-one', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  for (const [operators, tours, zh, en] of [[1, 9, '一間旅行社，一次過比較', 'One tour operator, compared in one place'], [12, 2122, '十二間旅行社，一次過比較', 'Twelve tour operators, compared in one place'], [21, 3000, '二十一間旅行社，一次過比較', '21 tour operators, compared in one place']] as const) {
    mocks.loadSearchPage.mockResolvedValue({ ...homeData, counts: { ...counts, all: { tours, operators } } });
    const { unmount } = await renderPage({});
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(zh);
    expect(screen.getByText(`現有 ${tours.toLocaleString('en-US')} 個旅行團 · 報名請到旅行社自己的網站`)).toBeInTheDocument();
    unmount();
    const english = await renderPage({}, 'en');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en);
    english.unmount();
  }
});

it('with no tours listed at all, the home page says so plainly instead of counting operators', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue({ ...homeData, tours: [], total: 0, counts: { all: { tours: 0, operators: 0 }, destinations: [] } });
  await renderPage({});
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('比較香港旅行團');
  expect(screen.getByText('現時沒有列出旅行團。')).toBeInTheDocument();
});

it('a destination\'s page has the same band, with its own heading, counts and related links', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue({ ...data, state: { filters: { destination: { countryId: 'japan', regionId: null } }, sort: 'price', page: 1 } });
  await renderPage({ dest: 'japan' });
  const bandSection = screen.getByRole('heading', { level: 1 }).closest('section')!;
  expect(within(bandSection).getByRole('heading', { level: 1 })).toHaveTextContent('日本旅行團');
  expect(within(bandSection).getByText('現時列出 32 個旅行團，來自 3 間旅行社。')).toBeInTheDocument();
  expect(within(bandSection).getByRole('link', { name: '關西' })).toHaveAttribute('href', '/tours/japan-kansai');
  expect(within(bandSection).getByRole('combobox')).toHaveValue('日本 → 全部地區');
  expect(within(bandSection).getByRole('navigation', { name: '旅行團最多的目的地' })).toBeInTheDocument();
});

it('a destination\'s count line groups thousands, as the rest of the site does', async () => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  const big: DestinationCounts = { ...counts, destinations: [{ countryId: 'japan', regionId: null, tours: 2122, operators: 3 }, ...counts.destinations.slice(1)] };
  mocks.loadSearchPage.mockResolvedValue({ ...data, counts: big, state: { filters: { destination: { countryId: 'japan', regionId: null } }, sort: 'price', page: 1 } });
  const { unmount } = await renderPage({ dest: 'japan' });
  expect(screen.getByText('現時列出 2,122 個旅行團，來自 3 間旅行社。')).toBeInTheDocument();
  unmount();
  await renderPage({ dest: 'japan' }, 'en');
  expect(screen.getByText('Listing 2,122 tours from 3 operators.')).toBeInTheDocument();
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
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('三間旅行社，一次過比較');
});

it('on the error, the search page keeps a heading (the counts are unknown) above the message, and no search box', async () => {
  mocks.requestDb.mockRejectedValue(new Error('DATABASE_URL is not set'));
  await renderPage({});
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('比較香港旅行團');
  expect(screen.getByRole('alert')).toHaveTextContent(ERROR);
  expect(screen.queryByRole('combobox')).toBeNull();
});

// The home page without a query string is a stored copy (app/(zh-hant)/page.tsx…): StoredSearchPage, the same body.

it.each(['zh-Hant', 'zh-Hans', 'en'] as const)('in %s, the stored home page renders exactly what the page renders for its bare address', async locale => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.storedDb.mockResolvedValue(fakeDb);
  const bare = { ...homeData, state: { filters: {}, sort: 'price' as const, page: 1 } };
  mocks.loadSearchPage.mockResolvedValue(bare);
  const perRequest = await renderPage({}, locale);
  const expected = perRequest.container.innerHTML;
  perRequest.unmount();
  const stored = render(<I18nProvider locale={locale}>{await StoredSearchPage({ locale })}</I18nProvider>);
  expect(stored.container.innerHTML).toBe(expected);
  expect(stored.container.textContent).toContain(locale === 'en' ? '40 tours listed now' : '40');
});

it('the stored home page reads the page without any filter through the stored pages\' handle, in its language, never the per-request one', async () => {
  mocks.storedDb.mockResolvedValue(fakeDb);
  mocks.requestDb.mockRejectedValue(new Error('requestDb used by the stored page'));
  mocks.loadSearchPage.mockResolvedValue(homeData);
  await StoredSearchPage({ locale: 'zh-Hans' });
  expect(mocks.loadSearchPage).toHaveBeenCalledTimes(1);
  const [db, raw, today, locale, reads] = mocks.loadSearchPage.mock.calls[0];
  expect([db, raw, locale, reads]).toEqual([fakeDb, {}, 'zh-Hans', mocks.cachedReads]);
  expect(isIsoDate(today)).toBe(true);
  expect(mocks.requestDb).not.toHaveBeenCalled();
});

it('the stored home page never renders the "cannot read" message: a failed read, or an answer with no tours, throws, so no such page is stored', async () => {
  mocks.storedDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockRejectedValue(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }));
  await expect(StoredSearchPage({ locale: 'zh-Hant' })).rejects.toThrow(/^home page: the database at DATABASE_URL could not be read \(ECONNREFUSED\)/);
  mocks.loadSearchPage.mockResolvedValue({ ...homeData, tours: [], total: 0, counts: { all: { tours: 0, operators: 0 }, destinations: [] } });
  await expect(StoredSearchPage({ locale: 'en' })).rejects.toThrow(/^home page: the database answered with no rows/);
  mocks.storedDb.mockRejectedValue(new Error('DATABASE_URL is not set: the website needs it to read tours from the database.'));
  await expect(StoredSearchPage({ locale: 'en' })).rejects.toThrow(/DATABASE_URL/);
  expect(consoleError).not.toHaveBeenCalled();
});

it.each(['zh-Hant', 'zh-Hans', 'en'] as const)('in %s, the stored home page\'s metadata is the bare address\'s (title, description, canonical, languages, no robots), and reads nothing', async locale => {
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockResolvedValue(homeData);
  const perRequest = await searchPageMetadata(locale, Promise.resolve({}));
  mocks.loadSearchPage.mockReset();
  const stored = storedSearchPageMetadata(locale);
  expect(stored).toEqual(perRequest);
  expect(stored).not.toHaveProperty('robots');
  expect(mocks.loadSearchPage).not.toHaveBeenCalled();
  expect(mocks.storedDb).not.toHaveBeenCalled();
});
