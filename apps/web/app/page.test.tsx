import { it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isIsoDate } from '@hktours/core';
import type { Db, TourCardData } from '@hktours/db/read';
import { I18nProvider } from '../lib/i18n-client';
import type { SearchPageData } from '../lib/search-page-data';

const mocks = vi.hoisted(() => ({
  requestDb: vi.fn<() => Promise<Db>>(),
  loadSearchPage: vi.fn<(db: Db, raw: Record<string, string | string[] | undefined>, today: string) => Promise<SearchPageData>>(),
}));
vi.mock('../lib/db', () => ({ requestDb: mocks.requestDb }));
vi.mock('../lib/search-page-data', () => ({ loadSearchPage: mocks.loadSearchPage }));
vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()), // the real unstable_rethrow
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const { default: SearchPage } = await import('./page');

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

const data: SearchPageData = {
  state: { filters: { destination: { countryId: 'japan', regionId: 'japan-kansai' } }, sort: 'days', page: 1 },
  tours: [tour], total: 30,
  operators: [{ id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: null }],
  filterOperators: [{ id: 'jetour', nameZh: '捷旅', nameEn: 'Jetour', color: '#ee7b06', lastGoodRunAt: '2026-11-11T19:10:00Z' }],
};

async function renderPage(params: Record<string, string | string[] | undefined>) {
  const element = await SearchPage({ searchParams: Promise.resolve(params) });
  return render(<I18nProvider locale="zh-Hant">{element}</I18nProvider>);
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
  expect(next).toHaveAttribute('href', '/?dest=japan-kansai&sort=days&page=2');
  expect(container.textContent).not.toContain(ERROR);
  expect(consoleError).not.toHaveBeenCalled();
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
  expect(screen.getByRole('link', { name: '回到第 1 頁' })).toHaveAttribute('href', '/?dest=japan-kansai&sort=days');
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
