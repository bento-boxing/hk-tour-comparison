import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NavBar } from './NavBar';
import { translate, type T } from '../lib/i18n';

const tZh: T = (key, vars) => translate('zh-Hant', key, vars);

it('shows the site name and both links', () => {
  render(<NavBar current="search" t={tZh} />);
  expect(screen.getByText('旅行團比較')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '搜尋旅行團' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: '連續行程' })).toHaveAttribute('href', '/chain');
});

it('marks the current page', () => {
  render(<NavBar current="chain" t={tZh} />);
  expect(screen.getByRole('link', { name: '連續行程' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: '搜尋旅行團' })).not.toHaveAttribute('aria-current');
});
