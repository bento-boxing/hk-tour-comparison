import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeT } from '../lib/i18n';
import { ThemeSwitch } from './ThemeSwitch';

const action = vi.hoisted(() => ({ setTheme: vi.fn<(formData: FormData) => Promise<void>>() }));
vi.mock('../lib/theme-action', () => ({ setTheme: action.setTheme }));

beforeEach(() => { action.setTheme.mockReset(); action.setTheme.mockResolvedValue(undefined); });
afterEach(() => { document.documentElement.removeAttribute('data-theme'); });

const css = () => readFileSync(join(__dirname, 'ThemeSwitch.module.css'), 'utf8').replace(/\s+/g, ' ');

it.each([
  ['zh-Hant', '切換至深色模式', '切換至淺色模式'],
  ['zh-Hans', '切换至深色模式', '切换至浅色模式'],
  ['en', 'Switch to dark theme', 'Switch to light theme'],
] as const)('in %s: two buttons named for what they do, %s and %s; CSS shows the one for the other theme', (locale, toDark, toLight) => {
  render(<ThemeSwitch t={makeT(locale)} />);
  const dark = screen.getByRole('button', { name: toDark });
  const light = screen.getByRole('button', { name: toLight });
  expect([dark.getAttribute('value'), light.getAttribute('value')]).toEqual(['dark', 'light']);
  expect(dark).toHaveAttribute('title', toDark);
  // Icons only, hidden from assistive technology: the accessible name is the label.
  for (const b of [dark, light]) expect(b.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
});

it('choosing dark submits the form action with "dark" and turns the page dark at once, before the server answers', async () => {
  window.history.replaceState(null, '', '/chain?gap=1-3&ex=japan');
  render(<ThemeSwitch t={makeT('en')} />);
  await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
  expect(action.setTheme).toHaveBeenCalledTimes(1);
  expect(action.setTheme.mock.calls[0][0].get('theme')).toBe('dark');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(window.location.pathname + window.location.search).toBe('/chain?gap=1-3&ex=japan');
});

it('choosing light submits "light"', async () => {
  document.documentElement.setAttribute('data-theme', 'dark');
  render(<ThemeSwitch t={makeT('zh-Hant')} />);
  await userEvent.click(screen.getByRole('button', { name: '切換至淺色模式' }));
  expect(action.setTheme.mock.calls[0][0].get('theme')).toBe('light');
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});

it('is reachable and usable by keyboard', async () => {
  render(<ThemeSwitch t={makeT('zh-Hant')} />);
  await userEvent.tab();
  expect(screen.getByRole('button', { name: '切換至深色模式' })).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(action.setTheme.mock.calls[0][0].get('theme')).toBe('dark');
});

it('CSS: each button shows only in the theme it leaves (theme tokens), 44px for touch, with a visible focus ring', () => {
  expect(css()).toMatch(/\.toDark \{ display: var\(--when-light\); \}/);
  expect(css()).toMatch(/\.toLight \{ display: var\(--when-dark\); \}/);
  expect(css()).toMatch(/\.option \{[^}]*min-height: 44px[^}]*min-width: 44px/);
  expect(css()).toMatch(/\.option:focus-visible \{[^}]*outline: 2px solid var\(--bar-accent\)/);
  expect(css()).toMatch(/\.option \{[^}]*color: var\(--bar-text\)/);
});
