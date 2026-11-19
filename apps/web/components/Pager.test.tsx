import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PAGE_SIZE } from '@hktours/db/read';
import { makeT } from '../lib/i18n';
import type { SearchState } from '../lib/search-params';
import { Pager } from './Pager';

const t = makeT('zh-Hant');
const state = (page: number): SearchState => ({ filters: { daysMin: 4 }, sort: 'days', page });
const total = PAGE_SIZE * 2 + 1; // three pages

const query = (link: HTMLElement) => Object.fromEntries(new URL(link.getAttribute('href')!, 'http://localhost').searchParams);

it('page 1 has a next link and no previous link', () => {
  render(<Pager state={state(1)} total={total} t={t} />);
  expect(screen.getByText('第 1 / 3 頁')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '上一頁' })).toBeNull();
  const next = screen.getByRole('link', { name: '下一頁' });
  expect(next.tagName).toBe('A');
  expect(query(next)).toEqual({ dmin: '4', sort: 'days', page: '2' });
});

it('a middle page links both ways, keeping the filters', () => {
  render(<Pager state={state(2)} total={total} t={t} />);
  expect(screen.getByText('第 2 / 3 頁')).toBeInTheDocument();
  expect(query(screen.getByRole('link', { name: '上一頁' }))).toEqual({ dmin: '4', sort: 'days' }); // page 1 is the default
  expect(query(screen.getByRole('link', { name: '下一頁' }))).toEqual({ dmin: '4', sort: 'days', page: '3' });
});

it('the last page has no next link', () => {
  render(<Pager state={state(3)} total={total} t={t} />);
  expect(screen.getByText('第 3 / 3 頁')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '上一頁' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '下一頁' })).toBeNull();
});

it('a page beyond the last offers only a link back to page 1', () => {
  render(<Pager state={state(9)} total={total} t={t} />);
  expect(screen.queryByText(/^第 9/)).toBeNull();
  expect(screen.queryByRole('link', { name: '上一頁' })).toBeNull();
  expect(screen.queryByRole('link', { name: '下一頁' })).toBeNull();
  const first = screen.getByRole('link', { name: '回到第 1 頁' });
  expect(first.getAttribute('href')).toBe('/?dmin=4&sort=days');
});

it('a page beyond the last with no matches at all shows nothing (the empty state has the clear link)', () => {
  const { container } = render(<Pager state={state(4)} total={0} t={t} />);
  expect(container).toBeEmptyDOMElement();
});

it('shows nothing when everything fits on one page', () => {
  const { container } = render(<Pager state={state(1)} total={PAGE_SIZE} t={t} />);
  expect(container).toBeEmptyDOMElement();
});

it('a page address builder replaces the search page addresses (the chain page keeps its chain)', () => {
  render(<Pager state={state(2)} total={total} t={t} hrefFor={page => `/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&page=${page}`} />);
  expect(screen.getByRole('link', { name: '上一頁' })).toHaveAttribute('href', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&page=1');
  expect(screen.getByRole('link', { name: '下一頁' })).toHaveAttribute('href', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&page=3');
});

it('the builder is used for the back-to-page-1 link too', () => {
  render(<Pager state={state(9)} total={total} t={t} hrefFor={page => `/chain?gap=1-3&page=${page}`} />);
  expect(screen.getByRole('link', { name: '回到第 1 頁' })).toHaveAttribute('href', '/chain?gap=1-3&page=1');
});

it.each([
  ['zh-Hans', '/zh-hans?dmin=4&sort=days', '/zh-hans?dmin=4&sort=days&page=3'],
  ['en', '/en?dmin=4&sort=days', '/en?dmin=4&sort=days&page=3'],
] as const)('in %s the links stay in the language', (locale, prev, next) => {
  render(<Pager state={state(2)} total={total} t={makeT(locale)} />);
  const [prevLink, nextLink] = screen.getAllByRole('link');
  expect(prevLink).toHaveAttribute('href', prev);
  expect(nextLink).toHaveAttribute('href', next);
});

it('a page address from hrefFor (the chain page\'s) gets the language too', () => {
  render(<Pager state={state(2)} total={total} t={makeT('en')} hrefFor={page => `/chain?gap=1-3&page=${page}`} />);
  expect(screen.getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(['/en/chain?gap=1-3&page=1', '/en/chain?gap=1-3&page=3']);
});

it.each([
  ['zh-Hant', '/tours/japan?dmin=4&sort=days', '/tours/japan?dmin=4&sort=days&page=3'],
  ['zh-Hans', '/zh-hans/tours/japan?dmin=4&sort=days', '/zh-hans/tours/japan?dmin=4&sort=days&page=3'],
  ['en', '/en/tours/japan?dmin=4&sort=days', '/en/tours/japan?dmin=4&sort=days&page=3'],
] as const)('in %s on a destination\'s page the links stay on that page, the destination in the path', (locale, prev, next) => {
  const onJapan: SearchState = { filters: { destination: { countryId: 'japan', regionId: null }, daysMin: 4 }, sort: 'days', page: 2 };
  render(<Pager state={onJapan} total={total} t={makeT(locale)} />);
  expect(screen.getAllByRole('link').map(a => a.getAttribute('href'))).toEqual([prev, next]);
});
