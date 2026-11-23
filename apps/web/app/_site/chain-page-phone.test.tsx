import { it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChainState } from '@hktours/core';
import type { Db, TourCardData } from '@hktours/db/read';
import { I18nProvider } from '../../lib/i18n-client';
import { resolveChain } from '../../lib/chain';
import type { ChainPageData } from '../../lib/chain-page-data';
import { resetTripCache, TRIP_KEY } from '../../lib/remembered-trip';
import { setTripUndo } from '../../lib/trip-undo';
import styles from './chain-page.module.css';

// Task 71: the trip page on a phone (the owner's drawings Mobile16Trip, Mobile20TripLong, Mobile17Pick). The page is
// rendered whole (as chain-page.test.tsx does); CSS decides what a phone shows, so these find the phone's parts by
// their own names.

const mocks = vi.hoisted(() => ({
  requestDb: vi.fn<() => Promise<Db>>(),
  loadChainPage: vi.fn<(db: Db, raw: Record<string, string | string[] | undefined>, today: string, locale?: string, reads?: unknown) => Promise<ChainPageData>>(),
  push: vi.fn<(href: string, opts?: { scroll?: boolean }) => void>(),
  replace: vi.fn<(href: string, opts?: { scroll?: boolean }) => void>(),
}));
vi.mock('../../lib/db', () => ({ requestDb: mocks.requestDb }));
vi.mock('../../lib/chain-page-data', () => ({ loadChainPage: mocks.loadChainPage }));
vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  usePathname: () => '/chain',
  useSearchParams: () => new URLSearchParams(''),
}));

const { ChainPage } = await import('./chain-page');

const today = '2026-11-12';
beforeAll(() => { vi.setSystemTime(new Date('2026-11-12T04:00:00Z')); });
afterAll(() => { vi.useRealTimers(); });

const card = (key: string, operatorId: TourCardData['operatorId'], days: number, departures: TourCardData['departures'], price: number): TourCardData => ({
  key, operatorId, url: `https://example.test/${key}`, title: key, days, nights: days - 1,
  stops: [{ countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' }],
  start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
  fromPriceHkd: price, windowPriceHkd: price, fallbackPriceHkd: price,
  departures, priceChange: null, lastUpdated: '2026-11-11T19:10:00Z',
});
const A = card('egl:KIX5', 'egl', 5, [{ date: '2026-12-18', priceHkd: 7999 }], 7999);
const B = card('texpert:SEL5', 'texpert', 5, [{ date: '2026-12-24', priceHkd: 5699 }, { date: '2026-12-25', priceHkd: 5899 }], 5699);
const C = card('bigline:TPE4', 'bigline', 4, [{ date: '2026-12-29', priceHkd: 3980 }], 3980);
const tours = new Map([A, B, C].map(t => [t.key, t]));

const operators: ChainPageData['operators'] = [
  { id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: null },
  { id: 'texpert', nameZh: '專業旅運', nameEn: 'Travel Expert', color: '#7d3cc8', lastGoodRunAt: null },
  { id: 'bigline', nameZh: '大航假期', nameEn: 'Big Line Holiday', color: '#2a9d4b', lastGoodRunAt: null },
];
const search = { filters: { excludeCountryIds: ['japan'] }, sort: 'price' as const, page: 1 };

/** The page's data for these legs (all resolve), with B and C as the list. */
function pageFor(legs: [string, string][], extra: Partial<ChainPageData> = {}, pick = false): ChainPageData {
  const chain: ChainState = { legs: legs.map(([tourKey, departure]) => ({ tourKey, departure })), gap: { min: 1, max: 3 } };
  const resolved = resolveChain(chain, tours, today).legs;
  return {
    address: { chain, search, ...(pick ? { pick: true } : {}) },
    legs: resolved, droppedCount: 0,
    departWindow: resolved.length ? { from: '2026-12-24', to: '2026-12-26' } : null,
    next: resolved.length || pick ? { tours: [B, C], total: 2 } : null,
    full: false, operators, filterOperators: operators, bare: false, requested: chain, ...extra,
  };
}

async function renderPage(data: ChainPageData, locale: 'zh-Hant' | 'zh-Hans' | 'en' = 'zh-Hant') {
  mocks.loadChainPage.mockResolvedValue(data);
  const element = await ChainPage({ locale, searchParams: Promise.resolve({}) });
  return render(<I18nProvider locale={locale}>{element}</I18nProvider>);
}
/** The trip's undo message (the list's count is a status too). */
const undoStatus = () => document.querySelector<HTMLElement>('[data-undo]')!;
const steps = () => within(screen.getAllByRole('list').find(list => list.tagName === 'OL')!).getAllByRole('listitem');

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.requestDb.mockReset().mockResolvedValue({} as Db);
  mocks.loadChainPage.mockReset();
  mocks.push.mockReset();
  mocks.replace.mockReset();
  window.localStorage.clear();
  resetTripCache();
  act(() => { setTripUndo(null); });
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

const THREE: [string, string][] = [['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24'], ['bigline:TPE4', '2026-12-29']];
const HERE = '/chain?legs=egl%3AKIX5%402026-12-18%2Ctexpert%3ASEL5%402026-12-24%2Cbigline%3ATPE4%402026-12-29&gap=1-3&ex=japan';

it('the trip is numbered steps: each tour, the real rest between two, then the dashed button for the next', async () => {
  const { container } = await renderPage(pageFor(THREE));
  expect(container.firstElementChild).toHaveAttribute('data-view', 'trip');
  const items = steps();
  expect(items.map(li => li.textContent)).toEqual([
    expect.stringMatching(/^1東瀛遊5日HK\$7,999大阪12\/18 \(五\) – 12\/22 \(二\)/),
    '2休息 1 日',
    expect.stringMatching(/^3專業旅運5日HK\$5,699大阪12\/24 \(四\) – 12\/28 \(一\)$/),
    '4休息 0 日（翌日出發）', // 12/29, the day after the second ends: no rest, never the same day
    expect.stringMatching(/^5大航假期4日HK\$3,980大阪12\/29 \(二\) – 2027\/1\/1 \(五\)/),
    '6＋ 加入下一個旅行團 12/24 – 12/26 出發，可以不加›',
  ]);
  // Each tour opens its operator's page, named by the tour; the dashed button is one link, to the choosing screen.
  expect(within(items[0]).getByRole('link', { name: '東瀛遊：大阪，2026年12月18日（五）至2026年12月22日（二），HK$7,999' }))
    .toHaveAttribute('href', 'https://example.test/egl:KIX5');
  expect(within(items[5]).getByRole('link', { name: '加入下一個旅行團 12/24 – 12/26 出發，可以不加' }))
    .toHaveAttribute('href', `${HERE.replace('&ex=japan', '')}&pick=1&ex=japan`);
});

it('a × on the first and on the last tour only, named by the tour; one × for a single tour', async () => {
  const { unmount } = await renderPage(pageFor(THREE));
  const removes = screen.getAllByRole('button', { name: /^移除「/ });
  expect(removes.map(b => b.getAttribute('aria-label'))).toEqual(['移除「東瀛遊：大阪，5日4夜」', '移除「大航假期：大阪，4日3夜」']);
  expect(within(steps()[2]).queryByRole('button')).toBeNull();
  unmount();
  await renderPage(pageFor([['egl:KIX5', '2026-12-18']]));
  expect(screen.getAllByRole('button', { name: /^移除「/ })).toHaveLength(1);
});

it('the gold total: the tours, the whole span with the rest, and the summed price; then the small print', async () => {
  await renderPage(pageFor(THREE));
  const total = document.querySelector('[data-total]')!;
  expect(total).toHaveTextContent('合計 3 個旅行團 · 15 日HK$17,678'); // 12/18 to 1/1
  expect(total).not.toHaveTextContent('起'); // every departure has its own price
  expect(screen.getByText('按旅行團可開啟旅行社的網頁。報名請到每間旅行社的網站分別辦理。')).toBeInTheDocument();
});

it('removing the first tour makes the second the first; the message offers to undo it, and undoing goes back', async () => {
  const user = userEvent.setup();
  const { unmount } = await renderPage(pageFor(THREE));
  await user.click(screen.getByRole('button', { name: '移除「東瀛遊：大阪，5日4夜」' }));
  const after = '/chain?legs=texpert%3ASEL5%402026-12-24%2Cbigline%3ATPE4%402026-12-29&gap=1-3&ex=japan';
  expect(mocks.push).toHaveBeenLastCalledWith(after, { scroll: false });
  unmount();
  // The server renders the new address: the message is there, announced, and its button has focus.
  await renderPage(pageFor(THREE.slice(1)));
  const status = undoStatus();
  expect(status).toHaveAttribute('role', 'status');
  expect(status).toHaveTextContent('已移除 東瀛遊：大阪，5日4夜·還原');
  const undo = within(status).getByRole('button', { name: '還原' });
  expect(undo).toHaveFocus();
  await user.click(undo);
  expect(mocks.push).toHaveBeenLastCalledWith(HERE, { scroll: false });
  expect(status).toBeEmptyDOMElement();
});

it('removing the last tour, then any other change, ends the offer to undo', async () => {
  const user = userEvent.setup();
  const { unmount } = await renderPage(pageFor(THREE));
  await user.click(screen.getByRole('button', { name: '移除「大航假期：大阪，4日3夜」' }));
  expect(mocks.push).toHaveBeenLastCalledWith(HERE.replace('%2Cbigline%3ATPE4%402026-12-29', ''), { scroll: false });
  unmount();
  // Somewhere else instead (another removal, Back): no message there.
  await renderPage(pageFor([['egl:KIX5', '2026-12-18']]));
  expect(undoStatus()).toBeEmptyDOMElement();
});

/** The visitor remembers this trip already (as after building it). */
const remember = (legs: [string, string][]) => {
  window.localStorage.setItem(TRIP_KEY, JSON.stringify({ legs: legs.map(([k, d]) => `${k}@${d}`).join(','), gap: '1-3' }));
  resetTripCache();
};
const storedLegs = () => JSON.parse(window.localStorage.getItem(TRIP_KEY) ?? 'null')?.legs ?? null;
const ALL3 = 'egl:KIX5@2026-12-18,texpert:SEL5@2026-12-24,bigline:TPE4@2026-12-29';

it('清空 empties the trip and forgets it, with an undo; the empty trip offers the first tour', async () => {
  const user = userEvent.setup();
  remember(THREE);
  const { unmount } = await renderPage(pageFor(THREE));
  await user.click(screen.getByRole('button', { name: '清空行程' }));
  expect(mocks.push).toHaveBeenLastCalledWith('/chain?gap=1-3&ex=japan', { scroll: false });
  unmount();
  await renderPage(pageFor([]));
  expect(window.localStorage.getItem(TRIP_KEY)).toBeNull();
  expect(undoStatus()).toHaveTextContent('已清空·還原');
  expect(screen.queryByRole('button', { name: '清空行程' })).toBeNull();
  expect(steps().map(li => li.textContent)).toEqual(['1＋ 選擇第一個旅行團 逐個加入旅行團，看看連起來的日子和總價。›']);
  expect(screen.getByRole('link', { name: '選擇第一個旅行團 逐個加入旅行團，看看連起來的日子和總價。' }))
    .toHaveAttribute('href', '/chain?gap=1-3&pick=1&ex=japan');
  expect(document.querySelector('[data-total]')).toBeNull();
});

// Task 71 review: the remembered trip changes only by the visitor's own action on a trip.
it('the visitor\'s own changes are remembered: adding, ×, 還原', async () => {
  const user = userEvent.setup();
  remember(THREE.slice(0, 1));
  const one = await renderPage(pageFor(THREE.slice(0, 1), {}, true));
  const sel = screen.getAllByRole('row').find(row => row.textContent?.includes('專業旅運'))!;
  await user.click(within(sel).getByRole('button', { name: '加入行程 +' }));
  await user.click(screen.getByRole('button', { name: /2026年12月24日/ }));
  one.unmount();
  const two = await renderPage(pageFor(THREE.slice(0, 2)));
  expect(storedLegs()).toBe('egl:KIX5@2026-12-18,texpert:SEL5@2026-12-24');
  await user.click(screen.getByRole('button', { name: '移除「東瀛遊：大阪，5日4夜」' }));
  two.unmount();
  const after = await renderPage(pageFor(THREE.slice(1, 2)));
  expect(storedLegs()).toBe('texpert:SEL5@2026-12-24');
  await user.click(within(undoStatus()).getByRole('button', { name: '還原' }));
  after.unmount();
  await renderPage(pageFor(THREE.slice(0, 2)));
  expect(storedLegs()).toBe('egl:KIX5@2026-12-18,texpert:SEL5@2026-12-24');
});

it('Back through a built trip shows each older state but leaves the memory at the full trip, and says so', async () => {
  remember(THREE);
  for (const n of [2, 1]) {
    const { unmount } = await renderPage(pageFor(THREE.slice(0, n)));
    expect(storedLegs()).toBe(ALL3);
    expect(screen.getByText('這不是你儲存的行程')).toBeInTheDocument();
    unmount();
  }
  // ?gap= alone (an empty trip, as Back to the start shows it) erases nothing.
  await renderPage(pageFor([]));
  expect(storedLegs()).toBe(ALL3);
});

it('a link someone shared (or its choosing screen) is shown but does not replace the remembered trip; 改用這個行程 adopts it', async () => {
  const user = userEvent.setup();
  remember(THREE);
  const shared = await renderPage(pageFor(THREE.slice(1, 2), {}, true));
  expect(storedLegs()).toBe(ALL3);
  shared.unmount();
  await renderPage(pageFor(THREE.slice(1, 2)));
  expect(storedLegs()).toBe(ALL3);
  await user.click(screen.getByRole('button', { name: '改用這個行程' }));
  expect(storedLegs()).toBe('texpert:SEL5@2026-12-24');
  expect(screen.queryByRole('button', { name: '改用這個行程' })).toBeNull();
  expect(document.activeElement).toHaveAttribute('data-focus-tour');
  expect(document.activeElement).toHaveAccessibleName(/^專業旅運：大阪，2026年12月24日/);
});

it('with nothing remembered, merely opening a trip remembers nothing; the line says it is not saved', async () => {
  await renderPage(pageFor(THREE));
  expect(window.localStorage.getItem(TRIP_KEY)).toBeNull();
  expect(screen.getByText('這個行程未儲存')).toBeInTheDocument();
});

it('the remembered trip itself, with tours the server dropped, is pruned; with all of them gone, it is forgotten', async () => {
  remember(THREE);
  const requested = (legs: [string, string][]) => ({ legs: legs.map(([tourKey, departure]) => ({ tourKey, departure })), gap: { min: 1, max: 3 } });
  const pruned = await renderPage({ ...pageFor(THREE.slice(0, 2)), droppedCount: 1, requested: requested(THREE) });
  expect(storedLegs()).toBe('egl:KIX5@2026-12-18,texpert:SEL5@2026-12-24');
  expect(screen.queryByText('這不是你儲存的行程')).toBeNull();
  pruned.unmount();
  await renderPage({ ...pageFor([]), droppedCount: 2, requested: requested(THREE.slice(0, 2)) });
  expect(screen.getByText('部分旅行團已下架或日期已不適用，已從行程中移除。')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^選擇第一個旅行團/ })).toBeInTheDocument();
  expect(window.localStorage.getItem(TRIP_KEY)).toBeNull();
});

it('from 1024px too: the strip\'s remove-last and rest fields are the visitor\'s own changes', async () => {
  const user = userEvent.setup();
  remember(THREE.slice(0, 2));
  const two = await renderPage(pageFor(THREE.slice(0, 2)));
  await user.click(screen.getByRole('button', { name: '移除最後一程' }));
  two.unmount();
  const one = await renderPage(pageFor(THREE.slice(0, 1)));
  expect(storedLegs()).toBe('egl:KIX5@2026-12-18');
  const max = screen.getAllByRole('textbox', { name: '最多' })[0];
  await user.clear(max);
  await user.type(max, '5{Enter}');
  one.unmount();
  await renderPage({ ...pageFor(THREE.slice(0, 1)), address: { chain: { legs: [{ tourKey: 'egl:KIX5', departure: '2026-12-18' }], gap: { min: 1, max: 5 } }, search } });
  expect(JSON.parse(window.localStorage.getItem(TRIP_KEY)!)).toEqual({ legs: 'egl:KIX5@2026-12-18', gap: '1-5' });
});

it('the bare /chain goes to the remembered trip, except when Back or Forward brought the visitor there', async () => {
  remember(THREE);
  const bare = await renderPage({ ...pageFor([]), bare: true });
  expect(mocks.replace).toHaveBeenCalledWith(`/chain?legs=${encodeURIComponent(ALL3)}&gap=1-3`);
  bare.unmount();
  mocks.replace.mockReset();
  act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
  await renderPage({ ...pageFor([]), bare: true });
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(storedLegs()).toBe(ALL3);
});

it('the bare /chain with nothing remembered stays the empty trip', async () => {
  await renderPage({ ...pageFor([]), bare: true });
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(window.localStorage.getItem(TRIP_KEY)).toBeNull();
});

it('the choosing screen: its bar with ← back to the trip, the trip so far in gold, the window and the rest control, then the list', async () => {
  const { container } = await renderPage(pageFor(THREE.slice(0, 1), {}, true));
  expect(container.firstElementChild).toHaveAttribute('data-view', 'pick');
  expect(screen.getByRole('heading', { name: '選擇第 2 個旅行團' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '返回你的行程' })).toHaveAttribute('href', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&ex=japan');
  expect(document.querySelector('[data-total]')).toHaveTextContent('你的行程 1 個旅行團 · 5 日HK$7,999');
  expect(screen.getByText('12/24 – 12/26 出發')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '休息 1 至 3 日' })).toHaveAttribute('aria-expanded', 'false');
  // The trip's steps are not on this screen; the list is, with its rest notes and paging that keeps the screen.
  expect(screen.queryByRole('button', { name: /^移除「/ })).toBeNull();
  expect(screen.getAllByRole('row').length).toBeGreaterThan(2);
  expect(screen.getAllByText('休息 1–2 日後出發').length).toBeGreaterThan(0);
});

it('the rest control opens the two fields; 完成 applies them and keeps the screen; Escape changes nothing', async () => {
  const user = userEvent.setup();
  await renderPage(pageFor(THREE.slice(0, 1), {}, true));
  const chip = screen.getByRole('button', { name: '休息 1 至 3 日' });
  await user.click(chip);
  expect(chip).toHaveAttribute('aria-expanded', 'true');
  const panel = () => screen.getByRole('button', { name: '完成' }).parentElement!;
  const max = within(panel()).getByRole('textbox', { name: '最多' });
  expect(within(panel()).getByRole('textbox', { name: '最少' })).toHaveFocus();
  await user.clear(max);
  await user.type(max, '5');
  await user.keyboard('{Escape}');
  expect(chip).toHaveAttribute('aria-expanded', 'false');
  expect(chip).toHaveFocus();
  expect(mocks.push).not.toHaveBeenCalled();
  await user.click(chip);
  const max2 = within(panel()).getByRole('textbox', { name: '最多' });
  await user.clear(max2);
  await user.type(max2, '5');
  await user.click(screen.getByRole('button', { name: '完成' }));
  expect(mocks.push).toHaveBeenCalledTimes(1);
  expect(mocks.push).toHaveBeenLastCalledWith('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-5&pick=1&ex=japan', { scroll: false });
});

it('adding a tour on the choosing screen returns to the trip in place of the choosing screen (replace)', async () => {
  const user = userEvent.setup();
  await renderPage(pageFor(THREE.slice(0, 1), {}, true));
  const sel = screen.getAllByRole('row').find(row => row.textContent?.includes('專業旅運'))!;
  await user.click(within(sel).getByRole('button', { name: '加入行程 +' }));
  await user.click(screen.getByRole('button', { name: /2026年12月24日/ }));
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.replace).toHaveBeenCalledWith('/chain?legs=egl%3AKIX5%402026-12-18%2Ctexpert%3ASEL5%402026-12-24&gap=1-3&ex=japan');
});

it('the first tour: any tour that leaves, no total, no rest notes; adding it starts the trip', async () => {
  const user = userEvent.setup();
  await renderPage(pageFor([], {}, true));
  expect(screen.getByRole('heading', { name: '選擇第 1 個旅行團' })).toBeInTheDocument();
  expect(document.querySelector('[data-total]')).toBeNull();
  expect(screen.queryByRole('button', { name: /^休息/ })).toBeNull();
  expect(screen.queryByText(/後出發/)).toBeNull();
  // The list is the phone's only: from 1024px an empty trip shows its message, as before.
  expect(screen.getByRole('region', { name: '選擇第 1 個旅行團' })).toHaveClass(styles.phoneOnly);
  const tpe = screen.getAllByRole('row').find(row => row.textContent?.includes('大航假期'))!;
  await user.click(within(tpe).getByRole('button', { name: '加入行程 +' }));
  await user.click(screen.getByRole('button', { name: /2026年12月29日/ }));
  expect(mocks.replace).toHaveBeenCalledWith('/chain?legs=bigline%3ATPE4%402026-12-29&gap=1-3&ex=japan');
});

it.each([
  ['zh-Hans', '合计 3 个旅行团 · 15 天', '休息 0 天（翌日出发）', '＋ 加入下一个旅行团 12/24 – 12/26 出发，可以不加'],
  ['en', 'Total 3 tours · 15 days', 'No rest (leaves the next day)', '+ Add the next tour Departing 24 Dec – 26 Dec, if you want one'],
] as const)('in %s, the trip in the language\'s words', async (locale, total, rest, add) => {
  await renderPage(pageFor(THREE), locale);
  expect(document.querySelector('[data-total]')).toHaveTextContent(total);
  expect(screen.getByText(rest)).toBeInTheDocument();
  expect(steps().at(-1)).toHaveTextContent(add);
});

it('on a phone each screen shows only its own parts; from 1024px the page is as before', () => {
  const css = readFileSync(join(__dirname, 'chain-page.module.css'), 'utf8').replace(/\s+/g, ' ');
  const phone = css.slice(css.indexOf('@media (max-width: 1023px) { .phoneOnly'));
  expect(phone).toMatch(/\.wideOnly \{ display: none; \}/);
  expect(phone).toMatch(/\.view\[data-view='trip'\] \.next \{ display: none; \}/);
  const trip = readFileSync(join(__dirname, '../../components/TripPhone.module.css'), 'utf8').replace(/\s+/g, ' ');
  expect(trip).toMatch(/^\/\*[^]*?\*\/ \.trip, \.pick, \.clear \{ display: none; \}/);
});

// Task 73: on the choosing screen a phone has the search box that opens the full-screen search (the wide search box and
// 按國家選擇 are drawn from 1024px only); it builds this page's addresses, as the wide pickers do.
it('the choosing screen\'s phone search box opens the full-screen search; a choice keeps the trip and the screen', async () => {
  const user = userEvent.setup();
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  window.history.replaceState(null, '');
  await renderPage(pageFor(THREE.slice(0, 1), { screen: { popular: ['japan', 'korea', 'taiwan'], tours: null } }, true));
  const box = screen.getByRole('button', { name: '輸入國家、地區或城市' });
  expect(box.closest(`.${styles.phoneOnly}`)).not.toBeNull();
  expect(screen.getByRole('button', { name: '按國家選擇' }).closest(`.${styles.wideOnly}`)).not.toBeNull();
  await user.click(box);
  const dialog = screen.getByRole('dialog', { name: '選擇目的地' });
  // Task 75: the search page's popular destinations, without counts (the site's counts are not the tours that fit the
  // trip); then 按地區瀏覽.
  const popular = within(dialog).getByRole('region', { name: '熱門目的地' });
  expect(within(popular).getAllByRole('button').map(b => b.textContent)).toEqual(['日本', '韓國', '台灣']);
  expect(within(dialog).getByRole('region', { name: '按地區瀏覽' })).toBeInTheDocument();
  await user.keyboard('大阪{Enter}');
  await act(() => new Promise(r => setTimeout(r, 60)));
  expect(mocks.push).toHaveBeenCalledTimes(1);
  const [href, options] = mocks.push.mock.calls[0];
  const query = new URLSearchParams(href.slice(href.indexOf('?')));
  expect([href.slice(0, href.indexOf('?')), query.get('legs'), query.get('dest'), query.get('ex'), query.get('pick'), options])
    .toEqual(['/chain', 'egl:KIX5@2026-12-18', 'japan-kansai', 'japan', '1', { scroll: false }]);
  window.history.replaceState(null, '');
});

// Task 75: the choosing screen's filter sheet is the search page's, with the trip's own dates.
it.each([
  ['a later tour: 出發日期 is the trip\'s window, one line', THREE.slice(0, 1), '12/24 – 12/26 出發 · 由行程決定'],
  ['the first tour: 出發日期 as on the search page', [], null],
] as const)('the choosing screen\'s sheet, %s', async (_, legs, note) => {
  const user = userEvent.setup();
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  await renderPage(pageFor([...legs], legs.length ? {} : { seasons: [] }, true));
  await user.click(screen.getByRole('button', { name: /^篩選/ }));
  const sheet = screen.getByRole('dialog', { name: '篩選' });
  const dates = within(sheet).getByRole('group', { name: '出發日期' });
  if (note) {
    expect(dates).toHaveTextContent(note);
    expect(dates.querySelector('input')).toBeNull();
  } else {
    expect(dates.querySelectorAll('input[type=date]')).toHaveLength(2);
  }
  expect(within(sheet).queryByRole('group', { name: '可出行日期' })).toBeNull();
  expect(within(sheet).getByRole('group', { name: '排除國家：1 個' })).toBeInTheDocument();
});
