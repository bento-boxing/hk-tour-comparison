import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places, type ChainState, type OperatorId, type ScrapedDeparture, type Stop } from '@hktours/core';
import type { OperatorInfo, TourCardData } from '@hktours/db/read';
import { makeT } from '../lib/i18n';
import { resolveChain, type ResolvedLeg } from '../lib/chain';
import { ChainStrip, type ChainStripProps } from './ChainStrip';

const t = makeT('zh-Hant');
const today = '2026-11-12';

const kansai = (city: string): Stop => ({ countryId: 'japan', regionId: 'japan-kansai', cityId: `japan-kansai-${city}` });
const SEOUL: Stop = { countryId: 'korea', regionId: 'korea-seoul', cityId: 'korea-seoul-seoul' };

function card(key: string, days: number, stops: Stop[], departures: ScrapedDeparture[], fallbackPriceHkd: number): TourCardData {
  return {
    key, operatorId: key.split(':')[0] as OperatorId, url: `https://example.test/${key}`, title: key, days, nights: days - 1, stops,
    start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
    fromPriceHkd: fallbackPriceHkd, windowPriceHkd: fallbackPriceHkd, fallbackPriceHkd,
    departures, priceChange: null, lastUpdated: '2026-11-11T19:10:00Z',
  };
}

const A = card('egl:KIX5', 5, [kansai('osaka'), kansai('kyoto'), kansai('nara'), kansai('kobe')],
  [{ date: '2026-12-18', priceHkd: 7999 }, { date: '2026-12-27', priceHkd: 8999 }], 7999);
const B = card('texpert:SEL5', 5, [SEOUL], [{ date: '2026-12-24', priceHkd: 5699 }, { date: '2026-12-25', priceHkd: null }], 5699);
const tours = new Map([A, B].map(c => [c.key, c]));

const operators: OperatorInfo[] = [
  { id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: null },
  { id: 'texpert', nameZh: '專業旅運', nameEn: 'Travel Expert', color: '#7d3cc8', lastGoodRunAt: null },
];

const legsOf = (...legs: [string, string][]): ResolvedLeg[] => {
  const state: ChainState = { legs: legs.map(([tourKey, departure]) => ({ tourKey, departure })), gap: { min: 1, max: 3 } };
  return resolveChain(state, tours, today).legs;
};

let onGapChange: ReturnType<typeof vi.fn<(gap: { min: number; max: number }) => void>>;
let onRemoveLast: ReturnType<typeof vi.fn<() => void>>;
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => { onGapChange = vi.fn(); onRemoveLast = vi.fn(); user = userEvent.setup(); });

function renderStrip(legs: ResolvedLeg[], extra: Partial<ChainStripProps> = {}) {
  const props: ChainStripProps = {
    legs, operators, places, today, t, gap: { min: 1, max: 3 },
    departWindow: { from: '2026-12-24', to: '2026-12-26' }, onGapChange, onRemoveLast, ...extra,
  };
  return render(<ChainStrip {...props} />);
}

const legBoxes = () => [...document.querySelectorAll<HTMLElement>('[data-leg]')];
const css = () => readFileSync(join(__dirname, 'ChainStrip.module.css'), 'utf8').replace(/\s+/g, ' ');

it('shows each leg with operator, dates and price', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-25']));
  const [first, second] = legBoxes();
  expect(within(first).getByText('大阪 → 京都 → 奈良 → 神戶')).toBeInTheDocument();
  expect(within(first).getByText('東瀛遊 · 12/18 – 12/22 · HK$7,999')).toBeInTheDocument();
  expect(within(second).getByText('首爾')).toBeInTheDocument();
  // A departure without its own price shows the stored from-price, marked 起.
  expect(within(second).getByText('專業旅運 · 12/25 – 12/29 · HK$5,699 起')).toBeInTheDocument();
});

it('a leg in another year shows the year, as the date chips in the rows do', () => {
  const C = card('egl:NY3', 3, [kansai('osaka')], [{ date: '2026-12-30', priceHkd: 4000 }], 4000);
  const legs = resolveChain({ legs: [{ tourKey: C.key, departure: '2026-12-30' }], gap: { min: 1, max: 3 } }, new Map([[C.key, C]]), today).legs;
  renderStrip(legs, { departWindow: { from: '2027-01-02', to: '2027-01-04' } });
  expect(screen.getByText('東瀛遊 · 12/30 – 2027/1/1 · HK$4,000')).toBeInTheDocument();
  expect(screen.getByText('可出發日：2027/1/2 – 2027/1/4')).toBeInTheDocument();
});

it('shows the rest between legs', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']));
  const rest = screen.getByText('休息 1 天');
  const [first, second] = legBoxes();
  expect(first.compareDocumentPosition(rest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(rest.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('shows the gap selector, then the window for the next leg, after the last leg', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18']));
  const placeholder = screen.getByText('可出發日：12/24 – 12/26');
  expect(placeholder.closest('[data-next]')).toHaveTextContent('＋ 從下方選擇下一個旅行團可出發日：12/24 – 12/26');
  const min = screen.getByRole('textbox', { name: '最少' });
  expect(min).toHaveValue('1');
  expect(screen.getByRole('textbox', { name: '最多' })).toHaveValue('3');
  const [leg] = legBoxes();
  expect(leg.compareDocumentPosition(min) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(min.compareDocumentPosition(placeholder) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('changing the gap calls back', async () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18']));
  const max = screen.getByRole('textbox', { name: '最多' });
  await user.clear(max);
  await user.type(max, '5{Enter}');
  expect(onGapChange).toHaveBeenCalledWith({ min: 1, max: 5 });
});

it('without a window (a full chain) shows neither the gap selector nor the placeholder', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18']), { departWindow: null });
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByText('＋ 從下方選擇下一個旅行團', { exact: false })).toBeNull();
  expect(screen.getByText('目前合計', { exact: false })).toBeInTheDocument();
});

// Task 71: the total is the summed price (起 when inexact, as before), the tours, and the whole span (first departure to
// last return, rest included), on one line.
it('shows the total: the summed price, the tours and the whole span, rest included', () => {
  const { unmount } = renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']));
  const total = screen.getByText('目前合計', { exact: false });
  expect(total).toHaveTextContent('目前合計HK$13,6982 個旅行團 · 11 天');
  expect(total).not.toHaveTextContent('起');
  expect(total).not.toHaveTextContent('連休息');
  expect(within(total).getByText('2 個旅行團 · 11 天')).toHaveClass(/totalCount/);
  expect(css()).toMatch(/\.totalCount \{ white-space: nowrap; \}/);
  unmount();

  renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-25']));
  expect(screen.getByText('目前合計', { exact: false })).toHaveTextContent('HK$13,698 起2 個旅行團 · 12 天');
});

it('a single leg: one tour and its own days', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18']));
  expect(screen.getByText('目前合計', { exact: false })).toHaveTextContent('目前合計HK$7,9991 個旅行團 · 5 天');
});

it.each([
  ['zh-Hans', '目前合计HK$13,6982 个旅行团 · 11 天'],
  ['en', 'Total so farHK$13,6982 tours · 11 days'],
] as const)('in %s, the total in the language\'s words', (locale, text) => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']), { t: makeT(locale) });
  expect(screen.getByText(/目前合计|Total so far/)).toHaveTextContent(text);
});

it('in English, one tour and one day are singular', () => {
  const D = card('egl:D1', 1, [kansai('osaka')], [{ date: '2026-12-18', priceHkd: 500 }], 500);
  const legs = resolveChain({ legs: [{ tourKey: D.key, departure: '2026-12-18' }], gap: { min: 1, max: 3 } }, new Map([[D.key, D]]), today).legs;
  renderStrip(legs, { t: makeT('en') });
  expect(screen.getByText(/Total so far/)).toHaveTextContent('1 tour · 1 day');
});

it('remove-last calls back', async () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']));
  const remove = screen.getByRole('button', { name: '移除最後一程' });
  await user.click(remove);
  expect(onRemoveLast).toHaveBeenCalledTimes(1);
  remove.focus();
  await user.keyboard('{Enter}');
  expect(onRemoveLast).toHaveBeenCalledTimes(2);
});

it('marks each leg with its operator colour: a dot before the route, no stripe down the edge', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']));
  const [first, second] = legBoxes();
  expect(first.style.getPropertyValue('--c')).toBe('#d62839');
  expect(second.style.getPropertyValue('--c')).toBe('#7d3cc8');
  const dot = first.querySelector('[aria-hidden="true"]')!;
  expect(dot.parentElement).toHaveTextContent('大阪');
  expect(css()).toMatch(/\.dot \{[^}]*background: var\(--c\);/);
  expect(css()).not.toMatch(/border-left/);
});

it('an unsafe colour falls back to the operator fallback grey (--op-fallback, the same in both themes)', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18']), { operators: [{ ...operators[0], color: 'red; background: url(x)' }] });
  expect(legBoxes()[0].style.getPropertyValue('--c')).toBe('var(--op-fallback)');
  expect(legBoxes()[0]).not.toHaveAttribute('style', expect.stringContaining('url'));
});

it('an operator missing from the list shows its id', () => {
  renderStrip(legsOf(['texpert:SEL5', '2026-12-24']), { operators: [] });
  expect(screen.getByText('texpert · 12/24 – 12/28 · HK$5,699')).toBeInTheDocument();
});

it('names the route and the operator in the visitor\'s language', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-25']), { t: makeT('en') });
  const [first, second] = legBoxes();
  expect(first).toHaveTextContent('Osaka → Kyoto → Nara → Kobe');
  expect(first).toHaveTextContent('EGL Tours');
  expect(first).not.toHaveTextContent('東瀛遊');
  expect(second).toHaveTextContent('Seoul');
  expect(second).toHaveTextContent('Travel Expert');
});

it('in English: day-first dates and "from" before an inexact price, in the legs and the total', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-25']), { t: makeT('en') });
  const [, second] = legBoxes();
  expect(second).toHaveTextContent('Travel Expert · 25 Dec – 29 Dec · from HK$5,699');
  const total = screen.getByText('Total so far', { exact: false });
  expect(total).toHaveTextContent('from HK$13,698');
  expect(total).toHaveTextContent('2 tours · 12 days');
  expect(screen.getByText('Departing 24 Dec – 26 Dec', { exact: false })).toBeInTheDocument();
});

it('in Simplified Chinese the total reads the tours and the days, rest included', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-25']), { t: makeT('zh-Hans') });
  expect(screen.getByText('目前合计', { exact: false })).toHaveTextContent('2 个旅行团 · 12 天');
});
