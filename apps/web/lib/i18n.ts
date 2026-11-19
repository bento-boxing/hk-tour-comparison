import zhHant from './dict.zh-Hant';
import zhHans from './dict.zh-Hans';
import en from './dict.en';

/**
 * The site's languages, in the order the switch shows them. Traditional Chinese is the default. Each page's
 * language comes from its address alone (lib/locale-path.ts).
 */
export const LOCALES = ['zh-Hant', 'zh-Hans', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh-Hant';

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
 * A translator bound to one locale. Server code makes one from the page's locale; client code gets one from
 * useT() in i18n-client.
 */
export function makeT(locale: Locale): T {
  return Object.assign((key: DictKey, vars?: TranslateVars) => translate(locale, key, vars), { locale });
}
