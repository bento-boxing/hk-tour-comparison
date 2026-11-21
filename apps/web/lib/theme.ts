/** The two colour themes. With no choice remembered, the visitor's system setting decides (theme.css). */
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * The localStorage entry that remembers the visitor's choice in this browser ('light' or 'dark'; none: follow the
 * system). Read only in the browser, by THEME_SCRIPT and lib/theme-choice.ts: the server never knows the theme, so
 * every page's HTML is the same for everyone.
 */
export const THEME_KEY = 'hktours.theme';

/**
 * The script in every page's <head> (components/ThemeScript.tsx), run by the browser as it reads the page, before
 * anything is drawn: puts the stored choice on <html data-theme> (nothing stored, or anything but 'light' or 'dark':
 * no attribute, and theme.css follows the system setting). Storage blocked: nothing throws, the system decides.
 * Plain ES5 in one function, so it runs in any browser and leaves nothing behind; lib/theme-script.test.ts runs this
 * exact text.
 */
export const THEME_SCRIPT = `(function () {
  var theme = null;
  try { theme = window.localStorage.getItem(${JSON.stringify(THEME_KEY)}); } catch (e) {}
  if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
})();`;
