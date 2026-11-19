import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places } from '@hktours/core';
import { I18nProvider } from '../lib/i18n-client';
import { parseSearchParams } from '../lib/search-params';
import { DestinationSearchConnected, DestinationPanelsConnected } from './DestinationConnected';

const push = vi.fn<(href: string) => void>();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => { push.mockReset(); });

/** The page's validated state, as the server hands it over. */
const state = (query: string) => parseSearchParams(Object.fromEntries(new URLSearchParams(query)), places);

it('the connected search bar goes to the chosen region\'s page, keeping the other filters, back on page 1', async () => {
  const user = userEvent.setup();
  render(<I18nProvider locale="zh-Hant"><DestinationSearchConnected state={state('sort=days&page=3&dmin=5')} /></I18nProvider>);
  await user.type(screen.getByRole('combobox', { name: '輸入國家、地區或城市' }), '大阪');
  await user.keyboard('{Enter}');
  expect(push).toHaveBeenCalledWith('/tours/japan-kansai?dmin=5&sort=days');
});

it('changing the destination on a destination\'s page goes to the other one\'s page with the same filters', async () => {
  const user = userEvent.setup();
  render(<I18nProvider locale="zh-Hant"><DestinationSearchConnected state={state('dest=korea&pmax=9000&page=2')} /></I18nProvider>);
  await user.clear(screen.getByRole('combobox'));
  await user.type(screen.getByRole('combobox'), '大阪');
  await user.keyboard('{Enter}');
  expect(push).toHaveBeenCalledWith('/tours/japan-kansai?pmax=9000');
});

it('clearing goes back to the search page with the other filters', async () => {
  const user = userEvent.setup();
  render(<I18nProvider locale="zh-Hant"><DestinationSearchConnected state={state('dest=korea&sort=days&page=3')} /></I18nProvider>);
  expect(screen.getByRole('combobox')).toHaveValue('韓國 → 全部地區');
  await user.click(screen.getByRole('button', { name: '清除' }));
  expect(push).toHaveBeenCalledWith('/?sort=days');
});

it('the connected panels go to a whole country\'s page', async () => {
  const user = userEvent.setup();
  render(<I18nProvider locale="zh-Hant"><DestinationPanelsConnected state={state('')} /></I18nProvider>);
  await user.click(screen.getByRole('button', { name: '按國家選擇' }));
  await user.click(screen.getByRole('button', { name: '日本' }));
  await user.click(screen.getByRole('button', { name: '全部地區' }));
  expect(push).toHaveBeenCalledWith('/tours/japan');
});

it.each([
  ['en', 'dmin=5', '/en/tours/japan-kansai?dmin=5'],
  ['zh-Hans', 'dmin=5', '/zh-hans/tours/japan-kansai?dmin=5'],
  ['zh-Hant', 'dmin=5', '/tours/japan-kansai?dmin=5'],
] as const)('in %s the choice stays in the page\'s language: %s → %s', async (locale, query, href) => {
  const user = userEvent.setup();
  render(<I18nProvider locale={locale}><DestinationSearchConnected state={state(query)} /></I18nProvider>);
  await user.type(screen.getByRole('combobox'), 'Osaka');
  await user.keyboard('{Enter}');
  expect(push).toHaveBeenCalledWith(href);
});

it.each([
  ['en', '/en?sort=days'],
  ['zh-Hans', '/zh-hans?sort=days'],
  ['zh-Hant', '/?sort=days'],
] as const)('in %s clearing goes to that language\'s search page: %s', async (locale, href) => {
  const user = userEvent.setup();
  render(<I18nProvider locale={locale}><DestinationSearchConnected state={state('dest=japan&sort=days')} /></I18nProvider>);
  await user.click(screen.getByRole('button', { name: /^(清除|Clear)$/ }));
  expect(push).toHaveBeenCalledWith(href);
});
