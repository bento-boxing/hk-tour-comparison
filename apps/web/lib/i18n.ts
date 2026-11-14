import zhHant from './dict.zh-Hant';
import zhHans from './dict.zh-Hans';
import en from './dict.en';

/** The site's languages, in the order the switch shows them. Traditional Chinese is the default. */
export const LOCALES = ['zh-Hant', 'zh-Hans', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh-Hant';

/** The cookie that remembers the visitor's choice on this device (read on the server, so the first paint is right). */
export const LOCALE_COOKIE = 'locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year, in seconds

/** `<html lang>` for each language. */
export const HTML_LANG: Record<Locale, string> = { 'zh-Hant': 'zh-Hant-HK', 'zh-Hans': 'zh-Hans', en: 'en' };

export type DictKey = keyof typeof import('./dict.zh-Hant').default;
export type TranslateVars = Record<string, string | number>;
/** The translate function every component receives as its `t` prop; `t.locale` is its language. */
export interface T {
  (key: DictKey, vars?: TranslateVars): string;
  readonly locale: Locale;
}

const dictionaries: Record<Locale, Record<DictKey, string>> = { 'zh-Hant': zhHant, 'zh-Hans': zhHans, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** The language a cookie value names, exactly; no cookie or anything else is Traditional Chinese. */
export function localeFromCookie(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Replaces {name} placeholders, and [name:one|other] with `one` when the value of `name` is 1, else `other`
 * (English plurals: '{n} [n:tour|tours]'). A placeholder with no value is left as written.
 */
export function translate(locale: Locale, key: DictKey, vars?: TranslateVars): string {
  const text = dictionaries[locale][key];
  if (!vars) return text;
  return text
    .replace(/\[(\w+):([^|\]]*)\|([^\]]*)\]/g, (whole, name: string, one: string, other: string) =>
      (name in vars ? (Number(vars[name]) === 1 ? one : other) : whole))
    .replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/**
 * A translator bound to one locale. Server code gets one from getT() in i18n-server; client code from
 * useT() in i18n-client.
 */
export function makeT(locale: Locale): T {
  return Object.assign((key: DictKey, vars?: TranslateVars) => translate(locale, key, vars), { locale });
}
