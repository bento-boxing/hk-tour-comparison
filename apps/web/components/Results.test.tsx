import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places } from '@hktours/core';
import type { OperatorInfo, TourCardData } from '@hktours/db/read';
import { translate, type T } from '../lib/i18n';
import { I18nProvider } from '../lib/i18n-client';
import { Results, type ResultsProps } from './Results';
import { ResultsConnected } from './ResultsConnected';

const push = vi.fn<(href: string) => void>();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const t: T = (key, vars) => translate('zh-Hant', key, vars);
const today = '2026-11-12';

const operators: OperatorInfo[] = [
  { id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: '2026-11-11T19:10:00Z' },
  { id: 'jetour', nameZh: '捷旅', nameEn: 'Jetour', color: '#ee7b06', lastGoodRunAt: '2026-11-11T19:14:00Z' },
];

const card = (key: string, operatorId: 'egl' | 'jetour', url: string): TourCardData => ({
  key, operatorId, url, title: key, days: 5, nights: 4,
  stops: [{ countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' }],
  start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
  fromPriceHkd: 7999, windowPriceHkd: 7999, fallbackPriceHkd: 7999,
  departures: [{ date: '2026-12-18', priceHkd: 7999 }, { date: '2026-12-20', priceHkd: 8299 }],
  priceChange: null, lastUpdated: '2026-11-11T19:10:00Z',
});
const tours = [card('egl:KIX5', 'egl', 'https://example.test/egl/KIX5'), card('jetour:OSA6', 'jetour', 'https://example.test/jetour/OSA6')];

const props: ResultsProps = { tours, total: 2, operators, places, today, t };

beforeEach(() => { push.mockReset(); });

it('renders one card per tour', () => {
  render(<Results {...props} />);
  const cards = screen.getAllByRole('article');
  expect(cards).toHaveLength(2);
  expect(cards[0]).toHaveTextContent('東瀛遊');
  expect(cards[1]).toHaveTextContent('捷旅');
  expect(screen.getAllByRole('link').map(a => a.getAttribute('href')))
    .toEqual(['https://example.test/egl/KIX5', 'https://example.test/jetour/OSA6']);
});

it('shows the count', () => {
  render(<Results {...props} />);
  expect(screen.getByText('共 2 個旅行團')).toBeInTheDocument();
});

it('counts every match, not just the cards on this page', () => {
  render(<Results {...props} total={57} />);
  expect(screen.getByText('共 57 個旅行團')).toBeInTheDocument();
});

it('shows the empty message and a clear link when there are none', () => {
  render(<Results {...props} tours={[]} total={0} />);
  expect(screen.getByText('找不到符合條件的旅行團')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '清除所有篩選' })).toHaveAttribute('href', '/');
  expect(screen.queryByRole('article')).toBeNull();
  expect(screen.queryByText(/個旅行團$/)).toBeNull();
});

it('a card whose operator is missing from the list still renders, in charcoal', () => {
  const { container } = render(<Results {...props} operators={[operators[1]]} />);
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(container.querySelector('article')!.style.getPropertyValue('--c')).toBe('var(--charcoal)');
});

it('cards get an add button only when onAdd is given', async () => {
  const onAdd = vi.fn();
  const { unmount } = render(<Results {...props} />);
  expect(screen.queryByRole('button', { name: '加入行程 ＋' })).toBeNull();
  unmount();
  render(<Results {...props} onAdd={onAdd} />);
  const buttons = screen.getAllByRole('button', { name: '加入行程 ＋' });
  expect(buttons).toHaveLength(2);
  await userEvent.setup().click(buttons[1]);
  await userEvent.setup().click(screen.getByRole('button', { name: /2026年12月20日/ }));
  expect(onAdd).toHaveBeenCalledWith(tours[1], '2026-12-20');
});

it('picking a date on a card navigates to the chain page with that leg', async () => {
  const user = userEvent.setup();
  render(<I18nProvider locale="zh-Hant"><ResultsConnected tours={tours} total={2} operators={operators} today={today} /></I18nProvider>);
  await user.click(screen.getAllByRole('button', { name: '加入行程 ＋' })[0]);
  await user.click(screen.getByRole('button', { name: /2026年12月18日/ }));
  expect(push).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledWith('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3');
  const url = new URL(push.mock.calls[0][0], 'http://localhost');
  expect(url.pathname).toBe('/chain');
  expect(Object.fromEntries(url.searchParams)).toEqual({ legs: 'egl:KIX5@2026-12-18', gap: '1-3' });
});

it('a footer note per card is shown with its updated text', () => {
  render(<Results {...props} footNote={tour => (tour.key === 'egl:KIX5' ? '休息 1 日後出發' : undefined)} />);
  const [first, second] = screen.getAllByRole('article');
  expect(first).toHaveTextContent('休息 1 日後出發');
  expect(first).toHaveTextContent('更新：');
  expect(second).not.toHaveTextContent('休息');
  expect(second).toHaveTextContent('更新：');
});

it('an empty message replaces the default one and its clear link', () => {
  render(<Results {...props} tours={[]} total={0} empty={<p>這段休息期內沒有可接續的旅行團</p>} />);
  expect(screen.getByText('這段休息期內沒有可接續的旅行團')).toBeInTheDocument();
  expect(screen.queryByText('找不到符合條件的旅行團')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
});

it('no cards but matches on other pages (a page past the last): a neutral line, not an empty message', () => {
  render(<Results {...props} tours={[]} total={30} empty={<p>這段休息期內沒有可接續的旅行團</p>} />);
  expect(screen.getByText('這一頁沒有內容。')).toBeInTheDocument();
  expect(screen.queryByText('這段休息期內沒有可接續的旅行團')).toBeNull();
  expect(screen.queryByText('找不到符合條件的旅行團')).toBeNull();
  expect(screen.queryByText('共 30 個旅行團')).toBeNull();
});
