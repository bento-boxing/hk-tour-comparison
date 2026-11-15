/** The two colour themes. With no choice remembered, the visitor's system setting decides (theme.css). */
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** The cookie that remembers the visitor's choice on this device (read on the server, so the first paint is right). */
export const THEME_COOKIE = 'theme';
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year, in seconds

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/** The theme a cookie value names, exactly; null (no choice: follow the system) for no cookie or anything else. */
export function themeFromCookie(value: string | undefined): Theme | null {
  return isTheme(value) ? value : null;
}
