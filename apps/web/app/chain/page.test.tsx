import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isIsoDate, MAX_CHAIN_LEGS, type ChainState } from '@hktours/core';
import type { Db, TourCardData } from '@hktours/db/read';
import { I18nProvider } from '../../lib/i18n-client';
import { resolveChain } from '../../lib/chain';
import type { ChainPageData } from '../../lib/chain-page-data';

const mocks = vi.hoisted(() => ({
  requestDb: vi.fn<() => Promise<Db>>(),
  loadChainPage: vi.fn<(db: Db, raw: Record<string, string | string[] | undefined>, today: string) => Promise<ChainPageData>>(),
  push: vi.fn<(href: string, opts?: { scroll?: boolean }) => void>(),
  /** The raw address the browser shows; the page must never build a link from it. */
  query: { value: '' },
}));
vi.mock('../../lib/db', () => ({ requestDb: mocks.requestDb }));
vi.mock('../../lib/chain-page-data', () => ({ loadChainPage: mocks.loadChainPage }));
vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()), // the real unstable_rethrow
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => '/chain',
  useSearchParams: () => new URLSearchParams(mocks.query.value),
}));

const { default: ChainPage } = await import('./page');

const fakeDb = {} as Db;
const ERROR = '暫時未能載入資料，請稍後再試。';
const today = '2026-11-12';

const card = (key: string, operatorId: TourCardData['operatorId'], days: number, departures: TourCardData['departures'], price: number): TourCardData => ({
  key, operatorId, url: `https://example.test/${key}`, title: key, days, nights: days - 1,
  stops: [{ countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' }],
  start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
  fromPriceHkd: price, windowPriceHkd: price, fallbackPriceHkd: price,
  departures, priceChange: null, lastUpdated: '2026-11-11T19:10:00Z',
});
const A = card('egl:KIX5', 'egl', 5, [{ date: '2026-12-18', priceHkd: 7999 }], 7999);
const B = card('texpert:SEL5', 'texpert', 5, [{ date: '2026-12-24', priceHkd: 5699 }, { date: '2026-12-25', priceHkd: 5899 }], 5699);
const C = card('bigline:TPE4', 'bigline', 4, [{ date: '2026-12-24', priceHkd: 3980 }], 3980);

const operators: ChainPageData['operators'] = [
  { id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: null },
  { id: 'jetour', nameZh: '捷旅', nameEn: 'Jetour', color: '#ee7b06', lastGoodRunAt: null },
  { id: 'texpert', nameZh: '專業旅運', nameEn: 'Travel Expert', color: '#7d3cc8', lastGoodRunAt: null },
  { id: 'bigline', nameZh: '大航假期', nameEn: 'Big Line Holiday', color: '#2a9d4b', lastGoodRunAt: null },
];

const chain: ChainState = { legs: [{ tourKey: 'egl:KIX5', departure: '2026-12-18' }], gap: { min: 1, max: 3 } };
const legs = resolveChain(chain, new Map([[A.key, A]]), today).legs;

const data: ChainPageData = {
  address: { chain, search: { filters: { excludeCountryIds: ['japan'] }, sort: 'price', page: 1 } },
  legs, droppedCount: 0, departWindow: { from: '2026-12-24', to: '2026-12-26' },
  next: { tours: [B, C], total: 30 }, full: false, operators,
  filterOperators: [operators[1], operators[2]], // jetour and texpert
};

async function renderPage(params: Record<string, string | string[] | undefined>) {
  const element = await ChainPage({ searchParams: Promise.resolve(params) });
  return render(<I18nProvider locale="zh-Hant">{element}</I18nProvider>);
}

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.requestDb.mockReset();
  mocks.loadChainPage.mockReset();
  mocks.push.mockReset();
  mocks.requestDb.mockResolvedValue(fakeDb);
  mocks.query.value = 'legs=egl%3AKIX5%402026-12-18&gap=1-3&ex=japan';
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { consoleError.mockRestore(); });

it('loads the page from the address and lays it out: strip, then the next-leg heading, filters, cards and paging', async () => {
  mocks.loadChainPage.mockResolvedValue(data);
  const { container } = await renderPage({ legs: 'egl:KIX5@2026-12-18', gap: '1-3', ex: 'japan' });

  expect(mocks.loadChainPage).toHaveBeenCalledTimes(1);
  const [db, raw, day] = mocks.loadChainPage.mock.calls[0];
  expect(db).toBe(fakeDb);
  expect(raw).toEqual({ legs: 'egl:KIX5@2026-12-18', gap: '1-3', ex: 'japan' });
  expect(isIsoDate(day)).toBe(true);

  const yours = screen.getByRole('heading', { name: '你的行程' });
  const leg = screen.getByText('東瀛遊 · 12/18 – 12/22 · HK$7,999');
  const gapMin = screen.getByRole('combobox', { name: '最少' });
  const placeholder = screen.getByText('可出發日：12/24 – 12/26');
  const heading = screen.getByRole('heading', { name: '可接續的旅行團（12/24 – 12/26 出發）' });
  const search = screen.getByRole('combobox', { name: '輸入國家、地區或城市' });
  const exclude = screen.getByRole('button', { name: '排除：日本' });
  const count = screen.getByText('共 30 個旅行團');
  const cards = screen.getAllByRole('article');
  const next = screen.getByRole('link', { name: '下一頁' });
  const inOrder = [yours, leg, gapMin, placeholder, heading, search, exclude, count, cards[0], next];
  for (let i = 1; i < inOrder.length; i++) {
    expect(inOrder[i - 1].compareDocumentPosition(inOrder[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
  // The chain page sets the departure window itself, so there is no date pill.
  expect(screen.queryByRole('button', { name: /出發日期/ })).toBeNull();
  expect(screen.queryByText('部分旅行團已下架或日期已不適用，已從行程中移除。')).toBeNull();
  expect(container.textContent).not.toContain(ERROR);
  expect(consoleError).not.toHaveBeenCalled();
});

it('paging links keep the chain and the filters', async () => {
  mocks.loadChainPage.mockResolvedValue(data);
  await renderPage({});
  expect(screen.getByRole('link', { name: '下一頁' })).toHaveAttribute('href', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&ex=japan&page=2');
});

it('each card says how many days of rest come before it', async () => {
  mocks.loadChainPage.mockResolvedValue(data);
  await renderPage({});
  const [sel, tpe] = screen.getAllByRole('article');
  expect(within(sel).getByText('休息 1–2 日後出發')).toBeInTheDocument(); // 12/24 and 12/25 after a tour ending 12/22
  expect(within(tpe).getByText('休息 1 日後出發')).toBeInTheDocument();
});

it('adding a card appends the leg and navigates, keeping the gap and filters', async () => {
  mocks.loadChainPage.mockResolvedValue(data);
  await renderPage({});
  const user = userEvent.setup();
  const [sel] = screen.getAllByRole('article');
  await user.click(within(sel).getByRole('button', { name: '加入行程 ＋' }));
  await user.click(screen.getByRole('button', { name: /2026年12月25日/ }));
  expect(mocks.push).toHaveBeenCalledWith('/chain?legs=egl%3AKIX5%402026-12-18%2Ctexpert%3ASEL5%402026-12-25&gap=1-3&ex=japan');
});

it('changing the gap and removing the last leg navigate to the new address', async () => {
  mocks.loadChainPage.mockResolvedValue({ ...data, address: { ...data.address, search: { ...data.address.search, page: 2 } } });
  await renderPage({});
  const user = userEvent.setup();
  await user.selectOptions(screen.getByRole('combobox', { name: '最多' }), '5');
  expect(mocks.push).toHaveBeenLastCalledWith('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-5&ex=japan', { scroll: false });
  await user.click(screen.getByRole('button', { name: '移除最後一程' }));
  expect(mocks.push).toHaveBeenLastCalledWith('/chain?gap=1-3&ex=japan', { scroll: false });
});

it('changing a filter keeps the legs and gap and goes back to page 1', async () => {
  mocks.loadChainPage.mockResolvedValue({ ...data, address: { ...data.address, search: { ...data.address.search, page: 2 } } });
  await renderPage({});
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '排除：日本' }));
  await user.click(screen.getByRole('checkbox', { name: '韓國' }));
  expect(mocks.push).toHaveBeenLastCalledWith('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&ex=japan%2Ckorea', { scroll: false });
});

it('no legs: the message with a link to the search page, and no list', async () => {
  mocks.loadChainPage.mockResolvedValue({ ...data, address: { ...data.address, chain: { ...chain, legs: [] } }, legs: [], departWindow: null, next: null });
  await renderPage({});
  expect(screen.getByText('先在「搜尋旅行團」選擇第一個旅行團，再回來加入下一程。')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '搜尋旅行團' })).toHaveAttribute('href', '/');
  expect(screen.queryByRole('article')).toBeNull();
  expect(screen.queryByRole('heading', { name: '你的行程' })).toBeNull();
  expect(screen.queryByText('部分旅行團已下架或日期已不適用，已從行程中移除。')).toBeNull();
});

it('dropped legs: the notice above the strip, and the page goes on with the legs that remain', async () => {
  mocks.loadChainPage.mockResolvedValue({ ...data, droppedCount: 2 });
  await renderPage({});
  const notice = screen.getByText('部分旅行團已下架或日期已不適用，已從行程中移除。');
  const yours = screen.getByRole('heading', { name: '你的行程' });
  expect(notice.compareDocumentPosition(yours) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getAllByRole('article')).toHaveLength(2);
});

it('every leg dropped: the notice and the no-legs message', async () => {
  mocks.loadChainPage.mockResolvedValue({ ...data, legs: [], droppedCount: 1, departWindow: null, next: null });
  await renderPage({});
  expect(screen.getByText('部分旅行團已下架或日期已不適用，已從行程中移除。')).toBeInTheDocument();
  expect(screen.getByText('先在「搜尋旅行團」選擇第一個旅行團，再回來加入下一程。')).toBeInTheDocument();
});

it(`a full chain (${MAX_CHAIN_LEGS} legs) shows the limit message instead of the list`, async () => {
  mocks.loadChainPage.mockResolvedValue({ ...data, full: true, departWindow: null, next: null });
  await renderPage({});
  expect(MAX_CHAIN_LEGS).toBe(8); // the message spells the limit out
  expect(screen.getByText('行程已達上限（8 程）。')).toBeInTheDocument();
  expect(screen.queryByRole('article')).toBeNull();
  expect(screen.queryByRole('heading', { name: /可接續的旅行團/ })).toBeNull();
  expect(screen.queryByRole('combobox', { name: '最少' })).toBeNull();
  expect(screen.getByRole('button', { name: '移除最後一程' })).toBeInTheDocument();
});

it('an empty list says to try a longer rest', async () => {
  mocks.loadChainPage.mockResolvedValue({ ...data, next: { tours: [], total: 0 } });
  await renderPage({});
  expect(screen.getByText('這段休息期內沒有可接續的旅行團，可嘗試延長休息日數。')).toBeInTheDocument();
  expect(screen.queryByText('找不到符合條件的旅行團')).toBeNull();
  expect(screen.queryByRole('link', { name: '清除所有篩選' })).toBeNull(); // that link would go to the search page and lose the chain
  expect(screen.getByRole('combobox', { name: '最多' })).toBeInTheDocument();
});

it('shows the error message, and logs the cause, when DATABASE_URL is missing', async () => {
  mocks.requestDb.mockRejectedValue(new Error('DATABASE_URL is not set: the website needs it to read tours from the database.'));
  await renderPage({ legs: 'egl:KIX5@2026-12-18' });
  expect(screen.getByText(ERROR)).toBeInTheDocument();
  expect(mocks.loadChainPage).not.toHaveBeenCalled();
  expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('chain page'), expect.objectContaining({ message: expect.stringContaining('DATABASE_URL') }));
});

it('shows the error message when the database is unreachable, without the details', async () => {
  mocks.loadChainPage.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' }));
  const { container } = await renderPage({ legs: 'egl:KIX5@2026-12-18' });
  expect(screen.getByText(ERROR)).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/ECONNREFUSED|5432|at /);
  expect(consoleError).toHaveBeenCalledTimes(1);
});

// The visitor arrived with a leg that resolveChain dropped, a broken gap, dates and junk; the page shows the
// removal notice. Whatever they change next, the new address holds only the validated state.
const BROKEN = 'legs=egl%3AKIX5%402026-12-18%2Cegl%3ANOPE%402026-12-30&gap=abc&from=2026-12-01&to=2026-12-31&junk=1&page=2&ex=japan';
const arrived = (filters: ChainPageData['address']['search']['filters']): ChainPageData => ({
  ...data, droppedCount: 1, address: { chain, search: { filters, sort: 'price', page: 2 } },
});

it('choosing a destination in the search box keeps only the resolved legs and the clean gap, and goes back to page 1', async () => {
  mocks.query.value = BROKEN;
  mocks.loadChainPage.mockResolvedValue(arrived({ excludeCountryIds: ['japan'] }));
  await renderPage(Object.fromEntries(new URLSearchParams(BROKEN)));
  const user = userEvent.setup();
  await user.type(screen.getByRole('combobox', { name: '輸入國家、地區或城市' }), '大阪');
  await user.keyboard('{Enter}');
  expect(mocks.push).toHaveBeenCalledTimes(1);
  expect(mocks.push).toHaveBeenCalledWith('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&dest=japan-kansai&ex=japan', { scroll: false });
});

it('choosing a destination in the country panels does the same', async () => {
  mocks.query.value = BROKEN;
  mocks.loadChainPage.mockResolvedValue(arrived({ excludeCountryIds: ['japan'] }));
  await renderPage(Object.fromEntries(new URLSearchParams(BROKEN)));
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '按國家選擇' }));
  await user.click(screen.getByRole('button', { name: '韓國' }));
  await user.click(screen.getByRole('button', { name: '全部地區' }));
  expect(mocks.push).toHaveBeenCalledTimes(1);
  expect(mocks.push).toHaveBeenCalledWith('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&dest=korea&ex=japan', { scroll: false });
});

it('clearing the destination removes only it, keeping the resolved legs and clean gap, back on page 1', async () => {
  mocks.query.value = `${BROKEN}&dest=korea`;
  mocks.loadChainPage.mockResolvedValue(arrived({ destination: { countryId: 'korea', regionId: null }, excludeCountryIds: ['japan'] }));
  await renderPage(Object.fromEntries(new URLSearchParams(mocks.query.value)));
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '清除' }));
  expect(mocks.push).toHaveBeenCalledTimes(1);
  expect(mocks.push).toHaveBeenCalledWith('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&ex=japan', { scroll: false });
});

it('a page past the last says so neutrally, with the link back to page 1 that keeps the chain', async () => {
  mocks.loadChainPage.mockResolvedValue({ ...data, address: { ...data.address, search: { ...data.address.search, page: 9 } }, next: { tours: [], total: 30 } });
  await renderPage({});
  expect(screen.getByText('這一頁沒有內容。')).toBeInTheDocument();
  expect(screen.queryByText('這段休息期內沒有可接續的旅行團，可嘗試延長休息日數。')).toBeNull();
  expect(screen.getByRole('link', { name: '回到第 1 頁' })).toHaveAttribute('href', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&ex=japan');
});

it('the filter bar offers filterOperators; the strip and cards look operators up in the full list', async () => {
  mocks.loadChainPage.mockResolvedValue(data);
  await renderPage({});
  expect(screen.getByText('東瀛遊 · 12/18 – 12/22 · HK$7,999')).toBeInTheDocument(); // egl's leg, from `operators`
  const [, tpe] = screen.getAllByRole('article');
  expect(within(tpe).getByText('大航假期')).toBeInTheDocument(); // bigline's card, from `operators`
  await userEvent.setup().click(screen.getByRole('button', { name: '旅行社：全部' }));
  const dialog = screen.getByRole('dialog', { name: '旅行社' });
  expect(within(dialog).getAllByRole('checkbox').map(box => box.parentElement?.textContent)).toEqual(['捷旅', '專業旅運']);
});
