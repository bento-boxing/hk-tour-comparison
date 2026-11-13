import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PAGE_SIZE } from '@hktours/db/read';
import { translate, type T } from '../lib/i18n';
import type { SearchState } from '../lib/search-params';
import { Pager } from './Pager';

const t: T = (key, vars) => translate('zh-Hant', key, vars);
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
