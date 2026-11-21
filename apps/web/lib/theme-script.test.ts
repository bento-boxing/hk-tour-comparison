import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { THEME_KEY, THEME_SCRIPT } from './theme';

// The script in every page's <head> (components/ThemeScript.tsx), run here exactly as the browser runs it: the same
// text, against jsdom's document and localStorage.
const run = () => { new Function(THEME_SCRIPT)(); };
const html = () => document.documentElement;

beforeEach(() => { window.localStorage.clear(); html().removeAttribute('data-theme'); });
afterEach(() => { vi.restoreAllMocks(); html().removeAttribute('data-theme'); });

it('the stored choice is kept under one name, holding the theme name only', () => {
  expect(THEME_KEY).toBe('hktours.theme');
});

it('no stored choice: no data-theme, so the system setting decides (theme.css), and nothing is written', () => {
  run();
  expect(html()).not.toHaveAttribute('data-theme');
  expect(window.localStorage.length).toBe(0);
});

it('reads no cookie: an old theme cookie (set by the server until task 53) is ignored', () => {
  document.cookie = 'theme=dark; Path=/';
  try {
    run();
    expect(html()).not.toHaveAttribute('data-theme');
    expect(document.cookie).toBe('theme=dark');
    expect(THEME_SCRIPT).not.toMatch(/cookie/i);
  } finally {
    document.cookie = 'theme=; Path=/; Max-Age=0';
  }
});

it.each(['light', 'dark'])('a stored %s: <html data-theme> says so before anything is drawn', theme => {
  window.localStorage.setItem(THEME_KEY, theme);
  run();
  expect(html()).toHaveAttribute('data-theme', theme);
});

it.each(['', 'Dark', 'system', 'dark ', '"dark"', 'constructor'])('a stored %j (not a theme) is ignored: the system decides', value => {
  window.localStorage.setItem(THEME_KEY, value);
  run();
  expect(html()).not.toHaveAttribute('data-theme');
});

it('storage blocked (the accessor throws): nothing throws, the system decides', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
  expect(run).not.toThrow();
  expect(html()).not.toHaveAttribute('data-theme');
});

it('storage unreadable (reading throws): nothing throws, the system decides', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
  expect(run).not.toThrow();
  expect(html()).not.toHaveAttribute('data-theme');
});

it('is a plain script: one statement, no imports, nothing left on window', () => {
  const before = new Set(Object.keys(window));
  run();
  expect(Object.keys(window).filter(k => !before.has(k))).toEqual([]);
  expect(THEME_SCRIPT).not.toMatch(/\bimport\b|\bexport\b|<\/script/i);
});
