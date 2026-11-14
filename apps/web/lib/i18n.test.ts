import { it, expect } from 'vitest';
import { HTML_LANG, LOCALES, localeFromCookie, makeT, translate, type DictKey, type Locale } from './i18n';
import zhHant from './dict.zh-Hant';
import zhHans from './dict.zh-Hans';
import en from './dict.en';

const dictionaries: Record<Locale, Record<string, string>> = { 'zh-Hant': zhHant, 'zh-Hans': zhHans, en };

it.each([
  ['zh-Hant', 'zh-Hant'],
  ['zh-Hans', 'zh-Hans'],
  ['en', 'en'],
  [undefined, 'zh-Hant'], // no cookie: always Traditional Chinese, whatever the browser's language
  ['', 'zh-Hant'],
  ['fr', 'zh-Hant'],
  ['EN', 'zh-Hant'],
  ['zh-hant', 'zh-Hant'],
  ['zh-Hans ', 'zh-Hant'],
  ['constructor', 'zh-Hant'],
] as const)('localeFromCookie(%j) → %s', (value, locale) => {
  expect(localeFromCookie(value)).toBe(locale);
});

it('offers the three languages, Traditional Chinese first', () => {
  expect(LOCALES).toEqual(['zh-Hant', 'zh-Hans', 'en']);
});

it('names each language for <html lang>', () => {
  expect(HTML_LANG).toEqual({ 'zh-Hant': 'zh-Hant-HK', 'zh-Hans': 'zh-Hans', en: 'en' });
});

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

it('every dictionary has exactly the keys of dict.zh-Hant.ts, none empty', () => {
  const keys = Object.keys(zhHant).sort();
  for (const locale of LOCALES) {
    expect(Object.keys(dictionaries[locale]).sort(), locale).toEqual(keys);
    for (const [key, text] of Object.entries(dictionaries[locale])) expect(text.trim(), `${locale} ${key}`).not.toBe('');
  }
});

it('every key uses the same {placeholders} in every language', () => {
  for (const key of Object.keys(zhHant)) {
    const expected = placeholders(zhHant[key as DictKey]);
    for (const locale of LOCALES) expect(placeholders(dictionaries[locale][key]), `${locale} ${key}`).toEqual(expected);
  }
});

/** Keys whose word choice counts a value that is shown elsewhere (the gap fields show their own numbers). */
const COUNT_ONLY: Record<string, string> = { 'chain.days': 'max' };

it('a [name:one|other] word choice only refers to one of its key\'s placeholders (or its documented count)', () => {
  for (const locale of LOCALES) {
    for (const [key, text] of Object.entries(dictionaries[locale])) {
      const allowed = [...placeholders(text), ...(COUNT_ONLY[key] ? [COUNT_ONLY[key]] : [])];
      for (const m of text.matchAll(/\[(\w+):/g)) expect(allowed, `${locale} ${key}`).toContain(m[1]);
    }
  }
});

it('translate fills placeholders', () => {
  expect(translate('zh-Hant', 'length.daysNights', { days: 5, nights: 4 })).toBe('5日4夜');
  expect(translate('zh-Hans', 'length.daysNights', { days: 5, nights: 4 })).toBe('5天4晚');
  expect(translate('en', 'length.daysNights', { days: 5, nights: 4 })).toBe('5 days, 4 nights');
});

it('translate picks the singular word for 1 and the plural otherwise', () => {
  expect(translate('en', 'length.days', { days: 1 })).toBe('1 day');
  expect(translate('en', 'length.days', { days: 2 })).toBe('2 days');
  expect(translate('en', 'length.days', { days: 0 })).toBe('0 days');
  expect(translate('en', 'search.count', { n: 1 })).toBe('1 tour');
  expect(translate('en', 'search.count', { n: 12 })).toBe('12 tours');
});

it('makeT carries its locale', () => {
  expect(makeT('zh-Hans').locale).toBe('zh-Hans');
  expect(makeT('en')('nav.search')).toBe(en['nav.search']);
});

it('the site name is 跟邊團 in every language', () => {
  for (const locale of LOCALES) expect(dictionaries[locale]['site.name']).toBe('跟邊團');
});

it('the Cantonese notice reads as the owner approved', () => {
  expect(zhHans['notice.cantonese']).toBe('旅行团一般以粤语进行，详情请向旅行社查询。');
  expect(en['notice.cantonese']).toBe('Tours are normally conducted in Cantonese. Check with the operator.');
});
