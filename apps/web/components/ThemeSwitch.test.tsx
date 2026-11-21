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

let removeFaces: (() => void) | undefined;
beforeEach(() => { window.localStorage.clear(); resetThemeChoice(); });
afterEach(() => {
  removeFaces?.(); removeFaces = undefined;
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
});

const css = () => readFileSync(join(__dirname, 'ThemeSwitch.module.css'), 'utf8').replace(/\s+/g, ' ');

/**
 * A `scheme` system, and the faces shown as theme.css and ThemeSwitch.module.css show them in a browser: the face for
 * the theme the page is not in (jsdom resolves no var(), so the swap is written out here; the CSS tests below check
 * that the module uses the theme tokens).
 */
function systemAndFaces(scheme: 'light' | 'dark') {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-color-scheme: dark)' && scheme === 'dark', media: query }));
  const other = scheme === 'dark' ? 'light' : 'dark';
  const style = document.createElement('style');
  // The system's theme unless the other one is chosen: there the face leading away from it is the one shown.
  const leave = (theme: string) => (theme === 'dark' ? styles.toDark : styles.toLight);
  style.textContent = `:root:not([data-theme='${other}']) .${leave(scheme)} { display: none; }
    :root[data-theme='${other}'] .${leave(other)} { display: none; }`;
  document.head.append(style);
  removeFaces = () => style.remove();
}

it.each([
  ['zh-Hant', '切換至深色模式', '切換至淺色模式'],
  ['zh-Hans', '切换至深色模式', '切换至浅色模式'],
  ['en', 'Switch to dark theme', 'Switch to light theme'],
] as const)('in %s: one button, named for what it does in the theme shown (%s, %s), with that name as its tooltip', (locale, toDark, toLight) => {
  systemAndFaces('light');
  const { container } = render(<ThemeSwitch t={makeT(locale)} />);
  expect(screen.getAllByRole('button')).toHaveLength(1);
  const button = screen.getByRole('button', { name: toDark });
  expect(container.querySelector(`.${styles.toDark}`)).toHaveAttribute('title', toDark);
  expect(container.querySelector(`.${styles.toLight}`)).toHaveAttribute('title', toLight);
  // The button has no name or tooltip of its own: the face shown names it.
  expect(button).not.toHaveAttribute('aria-label');
  expect(button).not.toHaveAttribute('title');
  document.documentElement.setAttribute('data-theme', 'dark');
  expect(screen.getByRole('button', { name: toLight })).toBe(button);
  // A plain button, not a form: nothing is sent to the server.
  expect(button).toHaveAttribute('type', 'button');
  expect(container.querySelector('form')).toBeNull();
  // Icons only, hidden from assistive technology: the accessible name is the face's text.
  const icons = button.querySelectorAll('svg');
  expect(icons).toHaveLength(2);
  for (const svg of icons) expect(svg).toHaveAttribute('aria-hidden', 'true');
});

it('draws the same markup whatever the theme (CSS picks the face), so the server\'s HTML and the browser\'s render match', () => {
  const markup = () => {
    const { container, unmount } = render(<ThemeSwitch t={makeT('en')} />);
    const html = container.innerHTML;
    unmount();
    return html;
  };
  const before = markup();
  window.localStorage.setItem(THEME_KEY, 'dark');
  document.documentElement.setAttribute('data-theme', 'dark');
  expect(markup()).toBe(before);
});

it('choosing dark turns the page dark at once and remembers it in this browser; the address stays', async () => {
  systemAndFaces('light');
  window.history.replaceState(null, '', '/chain?gap=1-3&ex=japan');
  render(<ThemeSwitch t={makeT('en')} />);
  await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
  expect(window.location.pathname + window.location.search).toBe('/chain?gap=1-3&ex=japan');
});

it('choosing light on a dark page', async () => {
  systemAndFaces('light');
  window.localStorage.setItem(THEME_KEY, 'dark');
  document.documentElement.setAttribute('data-theme', 'dark');
  render(<ThemeSwitch t={makeT('zh-Hant')} />);
  await userEvent.click(screen.getByRole('button', { name: '切換至淺色模式' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(window.localStorage.getItem(THEME_KEY)).toBe('light');
});

it('on a dark system with nothing chosen, the button turns the page light', async () => {
  systemAndFaces('dark');
  render(<ThemeSwitch t={makeT('en')} />);
  await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
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
  systemAndFaces('light');
  const logged = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
  render(<ThemeSwitch t={makeT('en')} />);
  await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  for (const spy of logged) expect(spy).not.toHaveBeenCalled();
});

it.each([
  // [system, stored choice, the button's name first, after Enter, after Space]
  ['light', null, 'Switch to dark theme', 'Switch to light theme', 'Switch to dark theme'],
  ['dark', null, 'Switch to light theme', 'Switch to dark theme', 'Switch to light theme'],
  ['light', 'dark', 'Switch to light theme', 'Switch to dark theme', 'Switch to light theme'],
  ['dark', 'light', 'Switch to dark theme', 'Switch to light theme', 'Switch to dark theme'],
] as const)('by keyboard on a %s system, stored %s: Enter and Space switch, focus stays on the button (renamed), Tab goes on', async (scheme, stored, first, afterEnter, afterSpace) => {
  systemAndFaces(scheme);
  if (stored) window.localStorage.setItem(THEME_KEY, stored);
  render(<><ThemeSwitch t={makeT('en')} /><a href="/next">after</a></>);
  await userEvent.tab();
  const button = screen.getByRole('button', { name: first });
  expect(button).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(screen.getByRole('button', { name: afterEnter })).toBe(button);
  expect(button).toHaveFocus();
  await userEvent.keyboard(' ');
  expect(screen.getByRole('button', { name: afterSpace })).toBe(button);
  expect(button).toHaveFocus();
  await userEvent.tab();
  expect(screen.getByRole('link', { name: 'after' })).toHaveFocus();
});

it('CSS: the button is always shown, so focus never falls off it; its faces swap with the theme tokens; 44 × 44px for touch at every width, with a visible focus ring', () => {
  expect(css()).toMatch(/\.toDark \{ display: var\(--when-light\); \}/);
  expect(css()).toMatch(/\.toLight \{ display: var\(--when-dark\); \}/);
  expect(css()).toMatch(/\.option \{[^}]*display: inline-flex/);
  // Nothing else is ever hidden: no display: none but the JavaScript-off rule for the whole switch.
  expect(css().replace('@media (scripting: none) { .switch { display: none; } }', '')).not.toMatch(/display: none/);
  expect(css()).toMatch(/\.option \{[^}]*min-height: 44px; min-width: 44px/);
  // The face fills the button, so its tooltip shows over the whole 44px box.
  expect(css()).toMatch(/\.face \{[^}]*min-height: 44px; min-width: 44px/);
  // The face's text names the button but is not drawn.
  expect(css()).toMatch(/\.label \{[^}]*clip-path: inset\(50%\)/);
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
