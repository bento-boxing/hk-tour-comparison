import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places, type ChainState, type OperatorId, type ScrapedDeparture, type Stop } from '@hktours/core';
import type { OperatorInfo, TourCardData } from '@hktours/db/read';
import { translate, type T } from '../lib/i18n';
import { resolveChain, type ResolvedLeg } from '../lib/chain';
import { ChainStrip, type ChainStripProps } from './ChainStrip';

const t: T = (key, vars) => translate('zh-Hant', key, vars);
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
    window: { from: '2026-12-24', to: '2026-12-26' }, onGapChange, onRemoveLast, ...extra,
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

it('a leg in another year shows the year, as on the cards', () => {
  const C = card('egl:NY3', 3, [kansai('osaka')], [{ date: '2026-12-30', priceHkd: 4000 }], 4000);
  const legs = resolveChain({ legs: [{ tourKey: C.key, departure: '2026-12-30' }], gap: { min: 1, max: 3 } }, new Map([[C.key, C]]), today).legs;
  renderStrip(legs, { window: { from: '2027-01-02', to: '2027-01-04' } });
  expect(screen.getByText('東瀛遊 · 12/30 – 2027/1/1 · HK$4,000')).toBeInTheDocument();
  expect(screen.getByText('可出發日：2027/1/2 – 2027/1/4')).toBeInTheDocument();
});

it('shows the rest between legs', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']));
  const rest = screen.getByText('休息 1 日');
  const [first, second] = legBoxes();
  expect(first.compareDocumentPosition(rest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(rest.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('shows the gap selector, then the window for the next leg, after the last leg', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18']));
  const placeholder = screen.getByText('可出發日：12/24 – 12/26');
  expect(placeholder.closest('[data-next]')).toHaveTextContent('＋ 從下方選擇下一個旅行團可出發日：12/24 – 12/26');
  const min = screen.getByRole('combobox', { name: '最少' });
  expect(min).toHaveValue('1');
  expect(screen.getByRole('combobox', { name: '最多' })).toHaveValue('3');
  const [leg] = legBoxes();
  expect(leg.compareDocumentPosition(min) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(min.compareDocumentPosition(placeholder) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('changing the gap calls back', async () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18']));
  await user.selectOptions(screen.getByRole('combobox', { name: '最多' }), '5');
  expect(onGapChange).toHaveBeenCalledWith({ min: 1, max: 5 });
});

it('without a window (a full chain) shows neither the gap selector nor the placeholder', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18']), { window: null });
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByText('＋ 從下方選擇下一個旅行團', { exact: false })).toBeNull();
  expect(screen.getByText('目前合計', { exact: false })).toBeInTheDocument();
});

it('shows the total, marking an inexact total with 起', () => {
  const { unmount } = renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']));
  const total = screen.getByText('目前合計', { exact: false });
  expect(within(total).getByText('HK$13,698')).toBeInTheDocument();
  expect(total).toHaveTextContent('目前合計HK$13,69810日（連休息共11日）');
  expect(total).not.toHaveTextContent('起');
  unmount();

  renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-25']));
  const inexact = screen.getByText('目前合計', { exact: false });
  expect(inexact).toHaveTextContent('HK$13,698 起');
  expect(inexact).toHaveTextContent('10日（連休息共12日）');
});

it('a single leg shows only its days', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18']));
  const total = screen.getByText('目前合計', { exact: false });
  expect(total).toHaveTextContent('目前合計HK$7,9995日');
  expect(total).not.toHaveTextContent('連休息');
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

it('uses the operator colour on each leg', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']));
  const [first, second] = legBoxes();
  expect(first.style.getPropertyValue('--c')).toBe('#d62839');
  expect(second.style.getPropertyValue('--c')).toBe('#7d3cc8');
  expect(css()).toMatch(/\.leg \{[^}]*border-left: 5px solid var\(--c\)/);
});

it('an unsafe colour falls back to charcoal', () => {
  renderStrip(legsOf(['egl:KIX5', '2026-12-18']), { operators: [{ ...operators[0], color: 'red; background: url(x)' }] });
  expect(legBoxes()[0].style.getPropertyValue('--c')).toBe('var(--charcoal)');
  expect(legBoxes()[0]).not.toHaveAttribute('style', expect.stringContaining('url'));
});

it('an operator missing from the list shows its id', () => {
  renderStrip(legsOf(['texpert:SEL5', '2026-12-24']), { operators: [] });
  expect(screen.getByText('texpert · 12/24 – 12/28 · HK$5,699')).toBeInTheDocument();
});

it('follows the mockup: panel strip, dashed khaki connector, dashed placeholder, cerulean total', () => {
  const rules = css();
  expect(rules).toMatch(/\.chain \{[^}]*background: var\(--panel\)[^}]*border-radius: var\(--radius-card\)[^}]*padding: 14px/);
  expect(rules).toMatch(/\.line \{[^}]*width: 70px[^}]*border-top: 2px dashed var\(--khaki\)/);
  expect(rules).toMatch(/\.gapbox \{[^}]*border: 2px solid var\(--cerulean\)/);
  expect(rules).toMatch(/\.leg\.next \{[^}]*border: 2px dashed var\(--khaki\)/);
  expect(rules).toMatch(/\.totalPrice \{[^}]*font-size: 20px[^}]*color: var\(--cerulean\)/);
});
