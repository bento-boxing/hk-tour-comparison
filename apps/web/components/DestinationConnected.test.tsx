import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../lib/i18n-client';
import { DestinationSearchConnected, DestinationPanelsConnected } from './DestinationConnected';

const push = vi.fn<(href: string) => void>();
let currentQuery = '';
let currentPath = '/';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => currentPath,
  useSearchParams: () => new URLSearchParams(currentQuery),
}));

beforeEach(() => { push.mockReset(); currentPath = '/'; currentQuery = 'sort=days&page=3&dest=korea'; });

it('the connected search bar puts the chosen region in the address and resets the page', async () => {
  const user = userEvent.setup();
  render(<I18nProvider locale="zh-Hant"><DestinationSearchConnected value={null} /></I18nProvider>);
  await user.type(screen.getByRole('combobox', { name: '輸入國家、地區或城市' }), '大阪');
  await user.keyboard('{Enter}');
  expect(push).toHaveBeenCalledWith('/?sort=days&dest=japan-kansai');
});

it('clearing removes the destination from the address', async () => {
  const user = userEvent.setup();
  render(<I18nProvider locale="zh-Hant"><DestinationSearchConnected value={{ countryId: 'korea', regionId: null }} /></I18nProvider>);
  await user.click(screen.getByRole('button', { name: '清除' }));
  expect(push).toHaveBeenCalledWith('/?sort=days');
});

it('the connected panels put a whole country in the address as its id', async () => {
  const user = userEvent.setup();
  currentQuery = '';
  render(<I18nProvider locale="zh-Hant"><DestinationPanelsConnected value={null} /></I18nProvider>);
  await user.click(screen.getByRole('button', { name: '按國家選擇' }));
  await user.click(screen.getByRole('button', { name: '日本' }));
  await user.click(screen.getByRole('button', { name: '全部地區' }));
  expect(push).toHaveBeenCalledWith('/?dest=japan');
});

it('on the chaining page a choice keeps the legs, gap and exclusions', async () => {
  const user = userEvent.setup();
  currentPath = '/chain';
  currentQuery = 'legs=egl%3AKIX5%402026-12-18&gap=1-3&ex=korea&page=2';
  render(<I18nProvider locale="zh-Hant"><DestinationSearchConnected value={null} /></I18nProvider>);
  await user.type(screen.getByRole('combobox'), '大阪');
  await user.keyboard('{Enter}');
  expect(push).toHaveBeenCalledTimes(1);
  const url = new URL(push.mock.calls[0][0], 'http://localhost');
  expect(url.pathname).toBe('/chain');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    legs: 'egl:KIX5@2026-12-18', gap: '1-3', ex: 'korea', dest: 'japan-kansai',
  });
});
