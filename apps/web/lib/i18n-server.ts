import { cookies } from 'next/headers';
import { LOCALE_COOKIE, localeFromCookie, makeT, type Locale, type T } from './i18n';

/**
 * The visitor's language, from the cookie the language switch sets. Server components only: reading the
 * request's cookies renders the route per request (every page here already is: requestDb).
 */
export async function getLocale(): Promise<Locale> {
  return localeFromCookie((await cookies()).get(LOCALE_COOKIE)?.value);
}

/** For server components: the translator for the visitor's language. */
export async function getT(): Promise<T> {
  return makeT(await getLocale());
}
