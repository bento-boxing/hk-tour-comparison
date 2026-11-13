import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../lib/i18n-client';
import { DestinationSearchConnected, DestinationPanelsConnected } from './DestinationConnected';

const push = vi.fn<(href: string) => void>();
let currentQuery = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(currentQuery),
}));

beforeEach(() => { push.mockReset(); currentQuery = 'sort=days&page=3&dest=korea'; });

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
