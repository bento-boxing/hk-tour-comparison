import { it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PAGE_SIZE } from '@hktours/core';
import { makeT } from '../lib/i18n';
import { chainPageHref } from '../lib/chain-href';
import type { SearchState } from '../lib/search-params';
import { Pager, pageNumbers } from './Pager';

const t = makeT('zh-Hant');
const state = (page: number, size?: 48 | 96): SearchState => ({ filters: { daysMin: 4 }, sort: 'days', page, ...(size ? { size } : {}) });
const total = PAGE_SIZE * 2 + 1; // three pages

const query = (link: HTMLElement) => Object.fromEntries(new URL(link.getAttribute('href')!, 'http://localhost').searchParams);
const numbers = () => within(screen.getByRole('list')).getAllByRole('link');

it('page 1: no previous link, the page numbers with 1 current, and a next link', () => {
  render(<Pager state={state(1)} total={total} t={t} />);
  expect(screen.queryByRole('link', { name: /上一頁/ })).toBeNull();
  expect(numbers().map(a => a.textContent)).toEqual(['1', '2', '3']);
  expect(screen.getByRole('link', { name: '第 1 頁' })).toHaveAttribute('aria-current', 'page');
  const next = screen.getByRole('link', { name: '下一頁' });
  expect(next.tagName).toBe('A');
  // The arrow is glued to its word (a no-break space), so it never ends up alone on a line.
  expect(next.textContent).toBe('下一頁 ›');
  expect(query(next)).toEqual({ dmin: '4', sort: 'days', page: '2' });
  // On a phone the numbers give way to this line (CSS); it is in the page either way.
  expect(screen.getByText('第 1 / 3 頁')).toBeInTheDocument();
});

it('a middle page links both ways and to every page, keeping the filters', () => {
  render(<Pager state={state(2)} total={total} t={t} />);
  expect(query(screen.getByRole('link', { name: '上一頁' }))).toEqual({ dmin: '4', sort: 'days' }); // page 1 is the default
  expect(screen.getByRole('link', { name: '上一頁' }).textContent).toBe('‹ 上一頁');
  expect(query(screen.getByRole('link', { name: '下一頁' }))).toEqual({ dmin: '4', sort: 'days', page: '3' });
  expect(numbers().map(query)).toEqual([{ dmin: '4', sort: 'days' }, { dmin: '4', sort: 'days', page: '2' }, { dmin: '4', sort: 'days', page: '3' }]);
  expect(screen.getByRole('link', { name: '第 2 頁' })).toHaveAttribute('aria-current', 'page');
});

it('the last page has no next link', () => {
  render(<Pager state={state(3)} total={total} t={t} />);
  expect(screen.getByRole('link', { name: '上一頁' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '下一頁' })).toBeNull();
});

it('many pages: the first, the last and the current with its neighbours, with … between', () => {
  expect(pageNumbers(1, 89)).toEqual([1, 2, null, 89]);
  expect(pageNumbers(2, 89)).toEqual([1, 2, 3, null, 89]);
  expect(pageNumbers(45, 89)).toEqual([1, null, 44, 45, 46, null, 89]);
  expect(pageNumbers(88, 89)).toEqual([1, null, 87, 88, 89]);
  expect(pageNumbers(3, 4)).toEqual([1, 2, 3, 4]);
  expect(pageNumbers(1, 1)).toEqual([1]);
  render(<Pager state={state(45)} total={PAGE_SIZE * 89} t={t} />);
  expect(numbers().map(a => a.textContent)).toEqual(['1', '44', '45', '46', '89']);
  expect(screen.getAllByText('…')).toHaveLength(2);
});

it('counts pages by the rows per page in the state, and keeps that size in every link', () => {
  render(<Pager state={state(1, 48)} total={100} t={t} />);
  expect(numbers().map(a => a.textContent)).toEqual(['1', '2', '3']);
  expect(query(screen.getByRole('link', { name: '下一頁' }))).toEqual({ dmin: '4', sort: 'days', size: '48', page: '2' });
});

it('a page beyond the last offers only a link back to page 1', () => {
  render(<Pager state={state(9)} total={total} t={t} />);
  expect(screen.queryByText(/^第 9/)).toBeNull();
  expect(screen.queryByRole('link', { name: '上一頁' })).toBeNull();
  expect(screen.queryByRole('link', { name: '下一頁' })).toBeNull();
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link', { name: '回到第 1 頁' }).getAttribute('href')).toBe('/?dmin=4&sort=days');
});

it('a page beyond the last with no matches at all shows nothing (the empty state has the clear link)', () => {
  const { container } = render(<Pager state={state(4)} total={0} t={t} />);
  expect(container).toBeEmptyDOMElement();
});

it('shows nothing when everything fits on one page', () => {
  const { container } = render(<Pager state={state(1)} total={PAGE_SIZE} t={t} />);
  expect(container).toBeEmptyDOMElement();
});

it('the chain page\'s address builder replaces the search page\'s, for every link (its chain is kept)', () => {
  const chain = { legs: [{ tourKey: 'egl:KIX5', departure: '2026-12-18' }], gap: { min: 1, max: 3 } };
  const hrefFor = (search: SearchState) => chainPageHref({ chain, search });
  const { unmount } = render(<Pager state={state(2)} total={total} t={t} hrefFor={hrefFor} />);
  expect(screen.getByRole('link', { name: '上一頁' })).toHaveAttribute('href', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&dmin=4&sort=days');
  expect(screen.getByRole('link', { name: '下一頁' })).toHaveAttribute('href', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&dmin=4&sort=days&page=3');
  unmount();
  render(<Pager state={state(9)} total={total} t={makeT('en')} hrefFor={hrefFor} />);
  expect(screen.getByRole('link', { name: 'Back to page 1' })).toHaveAttribute('href', '/en/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&dmin=4&sort=days');
});

it.each([
  ['zh-Hans', '上一页', '/zh-hans?dmin=4&sort=days', '/zh-hans?dmin=4&sort=days&page=3'],
  ['en', 'Previous', '/en?dmin=4&sort=days', '/en?dmin=4&sort=days&page=3'],
] as const)('in %s every link stays in the language', (locale, prevName, prev, next) => {
  render(<Pager state={state(2)} total={total} t={makeT(locale)} />);
  const links = screen.getAllByRole('link');
  expect(links[0]).toHaveAccessibleName(prevName);
  expect(links[0]).toHaveAttribute('href', prev);
  expect(links.at(-1)).toHaveAttribute('href', next);
  for (const a of links) expect(a.getAttribute('href')).toMatch(locale === 'en' ? /^\/en\?/ : /^\/zh-hans\?/);
});

it.each([
  ['zh-Hant', '/tours/japan?dmin=4&sort=days', '/tours/japan?dmin=4&sort=days&page=3'],
  ['zh-Hans', '/zh-hans/tours/japan?dmin=4&sort=days', '/zh-hans/tours/japan?dmin=4&sort=days&page=3'],
  ['en', '/en/tours/japan?dmin=4&sort=days', '/en/tours/japan?dmin=4&sort=days&page=3'],
] as const)('in %s on a destination\'s page the links stay on that page, the destination in the path', (locale, prev, next) => {
  const onJapan: SearchState = { filters: { destination: { countryId: 'japan', regionId: null }, daysMin: 4 }, sort: 'days', page: 2 };
  render(<Pager state={onJapan} total={total} t={makeT(locale)} />);
  const links = screen.getAllByRole('link').map(a => a.getAttribute('href'));
  expect([links[0], links.at(-1)]).toEqual([prev, next]);
});
