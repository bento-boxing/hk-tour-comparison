import { it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeT, type Locale } from '../lib/i18n';
import { LanguageSwitch } from './LanguageSwitch';

const action = vi.hoisted(() => ({ setLocale: vi.fn<(formData: FormData) => Promise<void>>() }));
vi.mock('../lib/locale-action', () => ({ setLocale: action.setLocale }));

beforeEach(() => { action.setLocale.mockReset(); action.setLocale.mockResolvedValue(undefined); });

const css = () => readFileSync(join(__dirname, 'LanguageSwitch.module.css'), 'utf8').replace(/\s+/g, ' ');

it.each([
  ['zh-Hant', '語言', '繁體中文'],
  ['zh-Hans', '语言', '简体中文'],
  ['en', 'Language', 'English'],
] as const)('in %s: a group labelled %s with the three languages, each named in itself, the current one pressed', (locale, label, current) => {
  render(<LanguageSwitch t={makeT(locale)} />);
  const group = screen.getByRole('group', { name: label });
  const buttons = within(group).getAllByRole('button');
  expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual(['繁體中文', '简体中文', 'English']);
  expect(buttons.map(b => b.getAttribute('lang'))).toEqual(['zh-Hant-HK', 'zh-Hans', 'en']);
  for (const b of buttons) expect(b).toHaveAttribute('aria-pressed', String(b.getAttribute('aria-label') === current));
  // Full names always; the short forms are for narrow screens and hidden from assistive technology.
  expect(buttons.map(b => b.textContent)).toEqual(['繁體中文繁', '简体中文简', 'EnglishEN']);
  for (const short of ['繁', '简', 'EN']) expect(within(group).getByText(short)).toHaveAttribute('aria-hidden', 'true');
});

it.each([
  ['zh-Hant', 'English', 'en'],
  ['en', '简体中文', 'zh-Hans'],
  ['zh-Hans', '繁體中文', 'zh-Hant'],
] as const)('in %s, choosing %s submits the form action with that language, without leaving the address', async (locale: Locale, name, chosen) => {
  window.history.replaceState(null, '', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&ex=japan');
  render(<LanguageSwitch t={makeT(locale)} />);
  await userEvent.click(screen.getByRole('button', { name }));
  expect(action.setLocale).toHaveBeenCalledTimes(1);
  const formData = action.setLocale.mock.calls[0][0];
  expect(formData.get('locale')).toBe(chosen);
  // The address (and so every parameter in it) is untouched: the action re-renders the same page.
  expect(window.location.pathname + window.location.search).toBe('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&ex=japan');
});

it('is reachable by keyboard', async () => {
  render(<LanguageSwitch t={makeT('zh-Hant')} />);
  await userEvent.tab();
  expect(screen.getByRole('button', { name: '繁體中文' })).toHaveFocus();
  await userEvent.tab();
  await userEvent.keyboard('{Enter}');
  expect(action.setLocale.mock.calls[0][0].get('locale')).toBe('zh-Hans');
});

it('is 44px tall for touch, sits at the right, and drops to 繁 / 简 / EN on phones', () => {
  expect(css()).toMatch(/\.option \{[^}]*min-height: 44px/);
  expect(css()).toMatch(/\.form \{ margin: 0 0 0 auto; \}/);
  expect(css()).toMatch(/\.short \{ display: none; \}/);
  expect(css()).toMatch(/@media \(max-width: 639px\) \{[^@]*\.long \{ display: none; \}[^@]*\.short \{ display: inline; \}/);
  // Phones: 26px wide (above the 24px minimum touch target), so the bar keeps one row at 375px in every language.
  expect(css()).toMatch(/@media \(max-width: 639px\) \{ \.option \{ min-width: 26px; padding: 0 3px; \}/);
  expect(css()).not.toMatch(/#[0-9a-f]{3,8}\b/i);
});
