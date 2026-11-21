import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeT } from '../lib/i18n';
import { THEME_KEY } from '../lib/theme';
import { resetThemeChoice } from '../lib/theme-choice';
import { ThemeSwitch } from './ThemeSwitch';
import styles from './ThemeSwitch.module.css';

beforeEach(() => { window.localStorage.clear(); resetThemeChoice(); });
afterEach(() => { vi.restoreAllMocks(); document.documentElement.removeAttribute('data-theme'); });

const css = () => readFileSync(join(__dirname, 'ThemeSwitch.module.css'), 'utf8').replace(/\s+/g, ' ');

it.each([
  ['zh-Hant', '切換至深色模式', '切換至淺色模式'],
  ['zh-Hans', '切换至深色模式', '切换至浅色模式'],
  ['en', 'Switch to dark theme', 'Switch to light theme'],
] as const)('in %s: two buttons named for what they do, %s and %s; CSS shows the one for the other theme', (locale, toDark, toLight) => {
  const { container } = render(<ThemeSwitch t={makeT(locale)} />);
  const dark = screen.getByRole('button', { name: toDark });
  const light = screen.getByRole('button', { name: toLight });
  expect(dark).toHaveAttribute('title', toDark);
  expect(light).toHaveAttribute('title', toLight);
  // Plain buttons, not a form: nothing is sent to the server.
  for (const b of [dark, light]) expect(b).toHaveAttribute('type', 'button');
  expect(container.querySelector('form')).toBeNull();
  // Icons only, hidden from assistive technology: the accessible name is the label.
  for (const b of [dark, light]) expect(b.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
});

it('choosing dark turns the page dark at once and remembers it in this browser; the address stays', async () => {
  window.history.replaceState(null, '', '/chain?gap=1-3&ex=japan');
  render(<ThemeSwitch t={makeT('en')} />);
  await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
  expect(window.location.pathname + window.location.search).toBe('/chain?gap=1-3&ex=japan');
});

it('choosing light on a dark page', async () => {
  window.localStorage.setItem(THEME_KEY, 'dark');
  document.documentElement.setAttribute('data-theme', 'dark');
  render(<ThemeSwitch t={makeT('zh-Hant')} />);
  await userEvent.click(screen.getByRole('button', { name: '切換至淺色模式' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(window.localStorage.getItem(THEME_KEY)).toBe('light');
});

it('once mounted, puts the stored choice back on <html> (development remounts clear it) and follows other tabs', () => {
  window.localStorage.setItem(THEME_KEY, 'dark');
  const { unmount } = render(<ThemeSwitch t={makeT('en')} />);
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  window.localStorage.setItem(THEME_KEY, 'light');
  window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: 'light' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  unmount();
  window.localStorage.setItem(THEME_KEY, 'dark');
  window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: 'dark' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});

it('storage blocked: the switch still works for this page, nothing throws, nothing is logged', async () => {
  const logged = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
  render(<ThemeSwitch t={makeT('en')} />);
  await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  for (const spy of logged) expect(spy).not.toHaveBeenCalled();
});

it('is reachable and usable by keyboard', async () => {
  render(<ThemeSwitch t={makeT('zh-Hant')} />);
  await userEvent.tab();
  expect(screen.getByRole('button', { name: '切換至深色模式' })).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});

it('CSS: each button shows only in the theme it leaves (theme tokens), 44 × 44px for touch at every width, with a visible focus ring', () => {
  expect(css()).toMatch(/\.toDark \{ display: var\(--when-light\); \}/);
  expect(css()).toMatch(/\.toLight \{ display: var\(--when-dark\); \}/);
  expect(css()).toMatch(/\.option \{[^}]*min-height: 44px; min-width: 44px/);
  // The only media query is for JavaScript off, not for a width.
  expect(css().match(/@media[^{]*/g)).toEqual(['@media (scripting: none) ']);
  expect(css()).toMatch(/\.option:focus-visible \{ outline: 2px solid var\(--header-accent\)/);
  expect(css()).toMatch(/\.option \{[^}]*color: var\(--header-text\)/);
});

it('CSS: with JavaScript off the switch is not shown (it could not work), and the page follows the system setting', () => {
  expect(css()).toMatch(/@media \(scripting: none\) \{ \.switch \{ display: none; \} \}/);
  const { container } = render(<ThemeSwitch t={makeT('en')} />);
  expect(container.firstElementChild).toHaveClass(styles.switch);
});
