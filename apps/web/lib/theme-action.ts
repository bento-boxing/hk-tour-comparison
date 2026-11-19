'use server';

import { cookies } from 'next/headers';
import { isTheme, THEME_COOKIE, THEME_COOKIE_MAX_AGE } from './theme';

/**
 * The theme switch's form action: remembers the chosen theme (`theme` in the form) for a year on this device.
 * Setting the cookie makes Next.js re-render the current page, at the same address,
 * with <html data-theme> set. Anything but 'light' or 'dark' is ignored. The cookie holds the theme name only.
 */
export async function setTheme(formData: FormData): Promise<void> {
  const theme = formData.get('theme');
  if (!isTheme(theme)) return;
  (await cookies()).set(THEME_COOKIE, theme, {
    path: '/',
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true, // only the server reads it
    secure: process.env.NODE_ENV === 'production',
  });
}
