import { isTheme, THEME_KEY, type Theme } from './theme';

// The visitor's theme choice in the browser: <html data-theme> and localStorage (THEME_KEY), as the saved tours are
// kept (lib/saved-tours.ts). The script in <head> (THEME_SCRIPT) applies the stored choice before the first paint;
// this module is the theme switch's side: choosing, and keeping the page in step with the stored choice afterwards.
// With storage unavailable (blocked, or full), a choice applies to the page in view only; nothing throws or warns.

/** A choice that applies to this page but is not in storage (it could not be kept), or null. */
let pageChoice: Theme | null = null;

/** The stored choice; null when there is none, or storage cannot be read. */
function stored(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function show(theme: Theme | null) {
  if (theme === null) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

/**
 * The switch: the page turns to `theme` at once, and the choice is remembered in this browser (every tab, from the
 * next page on). False when storage could not keep it: it then lasts for this page only.
 */
export function chooseTheme(theme: Theme): boolean {
  show(theme);
  try {
    window.localStorage.setItem(THEME_KEY, theme);
    pageChoice = null;
    return true;
  } catch {
    pageChoice = theme;
    return false;
  }
}

/**
 * The theme the page is in now: <html data-theme> when set, else the system setting. The same rule as theme.css, so
 * it is the theme whose colours are on the screen (and whose switch face is hidden).
 */
export function shownTheme(): Theme {
  const theme = document.documentElement.getAttribute('data-theme');
  if (isTheme(theme)) return theme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The switch's one button: the page turns to the other theme, remembered as chooseTheme does. */
export function switchTheme(): boolean {
  return chooseTheme(shownTheme() === 'dark' ? 'light' : 'dark');
}

/** Another tab changed the choice (or cleared the site's storage): show what is stored now; nothing: the system. */
function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== THEME_KEY) return;
  pageChoice = null;
  show(stored());
}

/** Back or forward to a page the browser kept in memory: it missed any change made meanwhile in another tab. */
function onPageShow(event: PageTransitionEvent) {
  if (event.persisted) show(stored() ?? pageChoice);
}

/**
 * For the theme switch, once mounted (on every page with the header), before paint: puts the choice on <html>. On a
 * page built by React in the browser (one that calls notFound(): its head script is text/plain and does not run,
 * see components/ThemeScript.tsx) this is what applies it; elsewhere it sets the value already there (Next.js's
 * "Preventing Flash" guide says React's Strict Mode remount in development can clear it). Then follows the choice
 * made in other tabs and catches up after back/forward from memory. Returns the function that stops following.
 */
export function keepThemeInStep(): () => void {
  const theme = stored() ?? pageChoice;
  if (theme !== null) show(theme);
  window.addEventListener('storage', onStorage);
  window.addEventListener('pageshow', onPageShow);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('pageshow', onPageShow);
  };
}

/** Tests only: forget a page-only choice, as a new page would. */
export function resetThemeChoice(): void {
  pageChoice = null;
}
