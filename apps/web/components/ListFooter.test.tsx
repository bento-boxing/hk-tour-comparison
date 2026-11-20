import { it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { makeT } from '../lib/i18n';
import { chainPageHref } from '../lib/chain-href';
import type { SearchState } from '../lib/search-params';
import { ListFooter, UpdatedNote } from './ListFooter';

const t = makeT('zh-Hant');
const state = (page: number, size?: 48 | 96): SearchState => ({ filters: { daysMin: 4 }, sort: 'days', page, ...(size ? { size } : {}) });
const sizes = () => within(screen.getByRole('group', { name: '每頁顯示' })).getAllByRole('link');

it('under the list: rows per page, which rows these are out of all the matches, and the pager', () => {
  render(<ListFooter state={state(1)} total={2122} t={t} />);
  expect(sizes().map(a => a.textContent)).toEqual(['24', '48', '96']);
  expect(screen.getByText('第 1–24 個，共 2,122 個旅行團')).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: '分頁' })).toBeInTheDocument();
});

it('the count is announced when a filter changes it', () => {
  render(<ListFooter state={state(1)} total={57} t={t} />);
  expect(screen.getByText('第 1–24 個，共 57 個旅行團')).toHaveAttribute('aria-live', 'polite');
});

it('counts the rows of this page: the last page holds the rest', () => {
  render(<ListFooter state={state(3)} total={57} t={t} />);
  expect(screen.getByText('第 49–57 個，共 57 個旅行團')).toBeInTheDocument();
});

it('marks the size shown and links each size, keeping every filter and the first row in view; 24 leaves the address', () => {
  render(<ListFooter state={state(3)} total={2122} t={t} />);
  const [s24, s48, s96] = sizes();
  expect(s24).toHaveAttribute('aria-current', 'true');
  expect(s48).not.toHaveAttribute('aria-current');
  // Rows 49–72: page 2 of 48, page 1 of 96.
  expect(s48).toHaveAttribute('href', '/?dmin=4&sort=days&size=48&page=2');
  expect(s96).toHaveAttribute('href', '/?dmin=4&sort=days&size=96');
  expect(s24).toHaveAttribute('href', '/?dmin=4&sort=days&page=3');
});

it('with 96 shown, the count and the pager follow it', () => {
  render(<ListFooter state={state(2, 96)} total={200} t={t} />);
  expect(sizes()[2]).toHaveAttribute('aria-current', 'true');
  expect(screen.getByText('第 97–192 個，共 200 個旅行團')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '下一頁' })).toHaveAttribute('href', '/?dmin=4&sort=days&size=96&page=3');
  // Back to 24: rows 97–120, page 5; a bigger page past the end comes back to the last page.
  expect(sizes()[0]).toHaveAttribute('href', '/?dmin=4&sort=days&page=5');
});

it('no size choice when every match fits the smallest page; no pager either', () => {
  render(<ListFooter state={state(1)} total={24} t={t} />);
  expect(screen.queryByRole('group', { name: '每頁顯示' })).toBeNull();
  expect(screen.getByText('第 1–24 個，共 24 個旅行團')).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).toBeNull();
});

it('nothing at all with no matches (the empty message has its own link)', () => {
  const { container } = render(<ListFooter state={state(1)} total={0} t={t} />);
  expect(container).toBeEmptyDOMElement();
});

it('a page past the last: only the pager\'s way back to page 1', () => {
  render(<ListFooter state={state(9)} total={30} t={t} />);
  expect(screen.queryByText(/共 30/)).toBeNull();
  expect(screen.queryByRole('group')).toBeNull();
  expect(screen.getByRole('link', { name: '回到第 1 頁' })).toHaveAttribute('href', '/?dmin=4&sort=days');
});

it.each([
  ['zh-Hans', '每页显示', '第 1–24 个，共 2,122 个旅行团', '/zh-hans?dmin=4&sort=days&size=48'],
  ['en', 'Per page', '1–24 of 2,122 tours', '/en?dmin=4&sort=days&size=48'],
] as const)('in %s: its wording, and every link in the language', (locale, label, count, size48) => {
  render(<ListFooter state={state(1)} total={2122} t={makeT(locale)} />);
  expect(screen.getByText(count)).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: label })).getByRole('link', { name: '48' })).toHaveAttribute('href', size48);
});

it('on a destination\'s page the sizes keep the destination in the path; on the chain page they keep the chain', () => {
  const onJapan: SearchState = { ...state(1), filters: { destination: { countryId: 'japan', regionId: null } } };
  const { unmount } = render(<ListFooter state={onJapan} total={100} t={makeT('en')} />);
  expect(within(screen.getByRole('group', { name: 'Per page' })).getByRole('link', { name: '48' }))
    .toHaveAttribute('href', '/en/tours/japan?sort=days&size=48');
  unmount();
  const chain = { legs: [{ tourKey: 'egl:KIX5', departure: '2026-12-18' }], gap: { min: 1, max: 3 } };
  render(<ListFooter state={state(1)} total={100} t={t} hrefFor={search => chainPageHref({ chain, search })} />);
  expect(sizes()[2]).toHaveAttribute('href', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&dmin=4&sort=days&size=96');
});

it('under the list, one line says when the data was last updated: the latest good run of any operator', () => {
  const operators = [{ lastGoodRunAt: '2026-11-11T19:10:00Z' }, { lastGoodRunAt: '2026-11-18T18:30:00Z' }, { lastGoodRunAt: null }];
  const { unmount } = render(<UpdatedNote operators={operators} t={t} />);
  expect(screen.getByText('資料更新：11月19日 · 各旅行社每晚更新一次 · 價錢及出發日期以旅行社網站為準')).toBeInTheDocument();
  unmount();
  const english = render(<UpdatedNote operators={operators} t={makeT('en')} />);
  expect(screen.getByText(/^Data updated 19 Nov · /)).toBeInTheDocument();
  english.unmount();
  // No operator has run: nothing to say.
  const { container } = render(<UpdatedNote operators={[{ lastGoodRunAt: null }]} t={t} />);
  expect(container).toBeEmptyDOMElement();
});
