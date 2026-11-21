import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { THEME_KEY } from './theme';
import { chooseTheme, keepThemeInStep, resetThemeChoice } from './theme-choice';

const html = () => document.documentElement;
let stop: (() => void) | undefined;

beforeEach(() => {
  window.localStorage.clear();
  html().removeAttribute('data-theme');
  resetThemeChoice();
});
afterEach(() => { stop?.(); stop = undefined; vi.restoreAllMocks(); html().removeAttribute('data-theme'); });

/** Another tab of the site changed the stored choice: the browser fires `storage` here (never in the tab that wrote). */
const fromAnotherTab = (value: string | null, key: string | null = THEME_KEY) => {
  if (key === null) window.localStorage.clear();
  else if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
};

it.each(['dark', 'light'] as const)('choosing %s: <html data-theme> at once, and remembered in localStorage (the name only)', theme => {
  expect(chooseTheme(theme)).toBe(true);
  expect(html()).toHaveAttribute('data-theme', theme);
  expect(window.localStorage.getItem(THEME_KEY)).toBe(theme);
  expect(window.localStorage.length).toBe(1);
  // No cookie: nothing about the theme is sent to the server.
  expect(document.cookie).toBe('');
});

it('storage blocked: the choice still applies to this page, nothing throws, nothing is logged', () => {
  const logged = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
  expect(chooseTheme('dark')).toBe(false);
  expect(html()).toHaveAttribute('data-theme', 'dark');
  stop = keepThemeInStep();
  expect(html()).toHaveAttribute('data-theme', 'dark');
  for (const spy of logged) expect(spy).not.toHaveBeenCalled();
});

it('storage full: the choice applies to this page, nothing throws', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
  expect(chooseTheme('light')).toBe(false);
  expect(html()).toHaveAttribute('data-theme', 'light');
});

it('keepThemeInStep puts the stored choice back on <html> (React clears it when it remounts <html> in development)', () => {
  window.localStorage.setItem(THEME_KEY, 'dark');
  stop = keepThemeInStep();
  expect(html()).toHaveAttribute('data-theme', 'dark');
});

it('keepThemeInStep with nothing stored leaves <html> as it is (the system decides)', () => {
  stop = keepThemeInStep();
  expect(html()).not.toHaveAttribute('data-theme');
});

it('keepThemeInStep re-applies a choice made on this page when storage could not keep it', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
  chooseTheme('dark');
  html().removeAttribute('data-theme');
  stop = keepThemeInStep();
  expect(html()).toHaveAttribute('data-theme', 'dark');
});

it('in step with the other tabs: a choice made there applies here', () => {
  stop = keepThemeInStep();
  fromAnotherTab('dark');
  expect(html()).toHaveAttribute('data-theme', 'dark');
  fromAnotherTab('light');
  expect(html()).toHaveAttribute('data-theme', 'light');
});

it('another tab cleared the choice (or the site\'s storage): back to following the system', () => {
  window.localStorage.setItem(THEME_KEY, 'dark');
  stop = keepThemeInStep();
  fromAnotherTab(null);
  expect(html()).not.toHaveAttribute('data-theme');
  chooseTheme('light');
  fromAnotherTab(null, null);
  expect(html()).not.toHaveAttribute('data-theme');
});

it('other storage changes (the saved tours) leave the theme alone', () => {
  window.localStorage.setItem(THEME_KEY, 'dark');
  stop = keepThemeInStep();
  window.localStorage.setItem(THEME_KEY, 'light'); // as if written without an event
  fromAnotherTab('[]', 'hktours.savedTours');
  expect(html()).toHaveAttribute('data-theme', 'dark');
});

it('back or forward to a page kept in memory (bfcache): the choice made meanwhile in another tab applies', () => {
  window.localStorage.setItem(THEME_KEY, 'light');
  stop = keepThemeInStep();
  window.localStorage.setItem(THEME_KEY, 'dark'); // while this page was in the cache, no storage event reached it
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(html()).toHaveAttribute('data-theme', 'dark');
  window.localStorage.removeItem(THEME_KEY);
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(html()).not.toHaveAttribute('data-theme');
});

it('stopping removes the listeners', () => {
  keepThemeInStep()();
  fromAnotherTab('dark');
  expect(html()).not.toHaveAttribute('data-theme');
});
