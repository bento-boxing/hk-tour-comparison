import { it, expect } from 'vitest';
import { getLocale, translate } from './i18n';
import zh from './dict.zh-Hant';
import en from './dict.en';

it.each([
  [{}, 'zh-Hant'],
  [{ DEV_LOCALE: 'en' }, 'en'],
  [{ DEV_LOCALE: 'en', VERCEL_ENV: 'preview' }, 'en'],
  [{ DEV_LOCALE: 'en', VERCEL_ENV: 'production' }, 'zh-Hant'],
  [{ DEV_LOCALE: 'fr' }, 'zh-Hant'],
  [{ DEV_LOCALE: 'EN' }, 'zh-Hant'],
])('getLocale(%j) → %s', (env, locale) => { expect(getLocale(env)).toBe(locale); });

it('both dictionaries have identical keys and no empty values', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  for (const v of [...Object.values(en), ...Object.values(zh)]) expect(v.length).toBeGreaterThan(0);
});

it('translate fills placeholders', () => {
  expect(translate('zh-Hant', 'length.daysNights', { days: 5, nights: 4 })).toBe('5日4夜');
});
