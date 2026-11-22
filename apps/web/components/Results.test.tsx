import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places } from '@hktours/core';
import type { OperatorInfo, TourCardData } from '@hktours/db/read';
import { makeT } from '../lib/i18n';
import { I18nProvider } from '../lib/i18n-client';
import { Results, type ResultsProps } from './Results';
import { ResultsConnected } from './ResultsConnected';

/** The tour rows of the list (an ARIA table): the rows with cells, not its visually hidden header row. */
const tourRows = () => screen.queryAllByRole('row').filter(row => within(row).queryAllByRole('cell').length > 0);
/** The one tour row on the page. */
const oneRow = () => { const rows = tourRows(); expect(rows).toHaveLength(1); return rows[0]; };


const push = vi.fn<(href: string) => void>();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const t = makeT('zh-Hant');
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

it('renders one row per tour, in order, each linking to its operator\'s page', () => {
  render(<Results {...props} />);
  const cards = tourRows();
  expect(cards).toHaveLength(2);
  expect(cards[0]).toHaveTextContent('東瀛遊');
  expect(cards[1]).toHaveTextContent('捷旅');
  // Each row's link is the gold button (its dates are links to the same page).
  expect(cards.map(c => within(c).getByRole('link', { name: /^(東瀛遊|捷旅)：/ }).getAttribute('href')))
    .toEqual(['https://example.test/egl/KIX5', 'https://example.test/jetour/OSA6']);
  // The count is under the list now (ListFooter), not here.
  expect(screen.queryByText(/個旅行團/)).toBeNull();
});

it('shows the empty message and a clear link when there are none', () => {
  render(<Results {...props} tours={[]} total={0} />);
  expect(screen.getByText('找不到符合條件的旅行團')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '清除所有篩選' })).toHaveAttribute('href', '/');
  expect(tourRows()).toHaveLength(0);
  expect(screen.queryByText(/個旅行團$/)).toBeNull();
});

it('a row whose operator is missing from the list still renders, in the fallback grey', () => {
  const { container } = render(<Results {...props} operators={[operators[1]]} />);
  expect(tourRows()).toHaveLength(2);
  expect(tourRows()[0].style.getPropertyValue('--c')).toBe('var(--op-fallback)');
});

it('rows get an add button only when onAdd is given', async () => {
  const onAdd = vi.fn();
  const { unmount } = render(<Results {...props} />);
  expect(screen.queryByRole('button', { name: '加入行程 +' })).toBeNull();
  unmount();
  render(<Results {...props} onAdd={onAdd} />);
  const buttons = screen.getAllByRole('button', { name: '加入行程 +' });
  expect(buttons).toHaveLength(2);
  await userEvent.setup().click(buttons[1]);
  await userEvent.setup().click(screen.getByRole('button', { name: /2026年12月20日/ }));
  expect(onAdd).toHaveBeenCalledWith(tours[1], '2026-12-20');
});

it('picking a date on a card navigates to the chain page with that leg', async () => {
  const user = userEvent.setup();
  render(<I18nProvider locale="zh-Hant"><ResultsConnected tours={tours} total={2} operators={operators} today={today} /></I18nProvider>);
  await user.click(screen.getAllByRole('button', { name: '加入行程 +' })[0]);
  await user.click(screen.getByRole('button', { name: /2026年12月18日/ }));
  expect(push).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledWith('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3');
  const url = new URL(push.mock.calls[0][0], 'http://localhost');
  expect(url.pathname).toBe('/chain');
  expect(Object.fromEntries(url.searchParams)).toEqual({ legs: 'egl:KIX5@2026-12-18', gap: '1-3' });
});

it('a note per row (the chain page\'s rest) is shown on its own row only; no row shows an update time', () => {
  render(<Results {...props} footNote={tour => (tour.key === 'egl:KIX5' ? '休息 1 日後出發' : undefined)} />);
  const [first, second] = tourRows();
  expect(first).toHaveTextContent('休息 1 日後出發');
  expect(second).not.toHaveTextContent('休息');
  expect(first).not.toHaveTextContent('更新');
});

it('the list is a table for screen readers: a header row naming the seven columns (not drawn), then one row per tour', () => {
  render(<Results {...props} />);
  const table = screen.getByRole('table', { name: '旅行團' });
  const [header, ...rows] = within(table).getAllByRole('row');
  expect(within(header).getAllByRole('columnheader').map(h => h.textContent))
    .toEqual(['旅行社', '日數', '地區', '路線', '出發日期', '價錢', '操作']);
  expect(header.className).toMatch(/visuallyHidden/);
  expect(rows).toHaveLength(2);
  for (const row of rows) expect(within(row).getAllByRole('cell')).toHaveLength(7);
  // Every row and cell on an element that may take the role (not <article>, whose role a validator will not let
  // be changed), each row directly in the table.
  for (const el of [header, ...rows, ...rows.flatMap(row => within(row).getAllByRole('cell'))]) expect(el.tagName).toBe('DIV');
  for (const row of [header, ...rows]) expect(row.parentElement).toBe(table);
});

it.each([
  ['zh-Hans', '旅行团', ['旅行社', '天数', '地区', '路线', '出发日期', '价格', '操作']],
  ['en', 'Tours', ['Operator', 'Length', 'Region', 'Route', 'Departures', 'Price', 'Actions']],
] as const)('in %s the table and its columns are named in the language', (locale, name, columns) => {
  render(<Results {...props} t={makeT(locale)} />);
  expect(within(screen.getByRole('table', { name })).getAllByRole('columnheader').map(h => h.textContent)).toEqual(columns);
});

it('passes the render\'s time to the rows, which mark an operator\'s old data', () => {
  render(<Results {...props} now="2026-11-14T00:00:00Z" />);
  // Both operators last ran on 11 Nov (19:10 UTC, 12 Nov in Hong Kong): more than 36 hours before.
  expect(screen.getAllByText('資料為 11月12日')).toHaveLength(6); // two rows, each with the tag in its three places (one shown per layout)
});

it('an empty message replaces the default one and its clear link', () => {
  render(<Results {...props} tours={[]} total={0} empty={<p>這段休息期內沒有可接續的旅行團</p>} />);
  expect(screen.getByText('這段休息期內沒有可接續的旅行團')).toBeInTheDocument();
  expect(screen.queryByText('找不到符合條件的旅行團')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
});

it('no rows but matches on other pages (a page past the last): a neutral line, not an empty message', () => {
  render(<Results {...props} tours={[]} total={30} empty={<p>這段休息期內沒有可接續的旅行團</p>} />);
  expect(screen.getByText('這一頁沒有內容。')).toBeInTheDocument();
  expect(screen.queryByText('這段休息期內沒有可接續的旅行團')).toBeNull();
  expect(screen.queryByText('找不到符合條件的旅行團')).toBeNull();
  expect(tourRows()).toHaveLength(0);
});

it.each([
  ['zh-Hans', '清除所有筛选条件', '/zh-hans'],
  ['en', 'Clear all filters', '/en'],
] as const)('in %s the clear link goes to the bare search page in the same language', (locale, name, href) => {
  render(<Results {...props} tours={[]} total={0} t={makeT(locale)} />);
  expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
});
