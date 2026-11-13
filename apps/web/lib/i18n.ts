import zh from './dict.zh-Hant';
import en from './dict.en';

export type Locale = 'zh-Hant' | 'en';
export type DictKey = keyof typeof import('./dict.zh-Hant').default;
export type TranslateVars = Record<string, string | number>;
/** The translate function every component receives as its `t` prop. */
export type T = (key: DictKey, vars?: TranslateVars) => string;

const dictionaries: Record<Locale, Record<DictKey, string>> = { 'zh-Hant': zh, en };

/**
 * 'en' only when DEV_LOCALE === 'en' and VERCEL_ENV !== 'production'. Otherwise 'zh-Hant'.
 * On Vercel (VERCEL === '1') a missing or empty VERCEL_ENV counts as production.
 */
export function getLocale(env: Record<string, string | undefined>): Locale {
  const onVercelWithoutEnv = env.VERCEL === '1' && !env.VERCEL_ENV;
  const production = env.VERCEL_ENV === 'production' || onVercelWithoutEnv;
  return env.DEV_LOCALE === 'en' && !production ? 'en' : 'zh-Hant';
}

/** Replaces {name} placeholders; a placeholder with no value is left as written. */
export function translate(locale: Locale, key: DictKey, vars?: TranslateVars): string {
  const text = dictionaries[locale][key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** A translator bound to one locale. Server code uses getT(); client code uses useT() from i18n-client. */
export function makeT(locale: Locale): T {
  return (key, vars) => translate(locale, key, vars);
}

/** For server components: the translator for the locale chosen by process.env. */
export function getT(): T {
  return makeT(getLocale(process.env));
}
