'use server';

import { cookies } from 'next/headers';
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from './i18n';

/**
 * The language switch's form action: remembers the chosen language (`locale` in the form) for a year on this
 * device. Setting the cookie makes Next.js re-render the current page, at the same address, in the new
 * language in the same round trip. Anything but one of the three languages is ignored. The cookie holds
 * the language code only.
 */
export async function setLocale(formData: FormData): Promise<void> {
  const locale = formData.get('locale');
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true, // only the server reads it
    secure: process.env.NODE_ENV === 'production',
  });
}
