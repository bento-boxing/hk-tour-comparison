import { it, expect } from 'vitest';
import { LOCALES, makeT, translate, type DictKey, type Locale } from './i18n';
import zhHant from './dict.zh-Hant';
import zhHans from './dict.zh-Hans';
import en from './dict.en';

const dictionaries: Record<Locale, Record<string, string>> = { 'zh-Hant': zhHant, 'zh-Hans': zhHans, en };

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

/**
 * Keys whose word choice counts a value that is shown elsewhere (the gap fields show their own numbers) or shown as
 * a word (the headline's 'Seven' is {n}; its number is {count}).
 */
const COUNT_ONLY: Record<string, string> = { 'chain.days': 'max', 'band.headline': 'count' };

it('a [name:one|other] word choice only refers to one of its key\'s placeholders (or its documented count)', () => {
  for (const locale of LOCALES) {
    for (const [key, text] of Object.entries(dictionaries[locale])) {
      const allowed = [...placeholders(text), ...(COUNT_ONLY[key] ? [COUNT_ONLY[key]] : [])];
      for (const m of text.matchAll(/\[(\w+):/g)) expect(allowed, `${locale} ${key}`).toContain(m[1]);
    }
  }
});

it('translate fills placeholders', () => {
  expect(translate('zh-Hant', 'length.daysNights', { days: 5, nights: 4 })).toBe('5天4夜');
  expect(translate('zh-Hans', 'length.daysNights', { days: 5, nights: 4 })).toBe('5天4晚');
  expect(translate('en', 'length.daysNights', { days: 5, nights: 4 })).toBe('5 days, 4 nights');
});

it('translate picks the singular word for 1 and the plural otherwise', () => {
  expect(translate('en', 'length.days', { days: 1 })).toBe('1 day');
  expect(translate('en', 'length.days', { days: 2 })).toBe('2 days');
  expect(translate('en', 'length.days', { days: 0 })).toBe('0 days');
  // A count already grouped by thousands ('2,122') is not the number 1, so it takes the plural.
  expect(translate('en', 'pager.range', { from: 1, to: 1, total: '1' })).toBe('1–1 of 1 tour');
  expect(translate('en', 'pager.range', { from: 1, to: 24, total: '2,122' })).toBe('1–24 of 2,122 tours');
  expect(translate('en', 'band.headline', { n: 'One', count: 1 })).toBe('One tour operator, compared in one place');
  expect(translate('en', 'band.headline', { n: 'Seven', count: 7 })).toBe('Seven tour operators, compared in one place');
});

it('makeT carries its locale', () => {
  expect(makeT('zh-Hans').locale).toBe('zh-Hans');
  expect(makeT('en')('nav.search')).toBe(en['nav.search']);
});

it('the site name is 跟邊團 in every language', () => {
  for (const locale of LOCALES) expect(dictionaries[locale]['site.name']).toBe('跟邊團');
});

it('the band and the row markers read as the owner chose (task 47): colloquial Cantonese in the search box only', () => {
  const wording = (key: DictKey) => LOCALES.map(locale => dictionaries[locale][key]);
  expect(wording('band.headline')).toEqual(['{n}間旅行社，一次過比較', '{n}家旅行社，一次比较', '{n} [count:tour operator|tour operators], compared in one place']);
  expect(wording('band.subline')).toEqual(['現有 {tours} 個旅行團 · 報名請到旅行社自己的網站', '现有 {tours} 个旅行团 · 报名请前往旅行社自己的网站', "{tours} [tours:tour|tours] listed now · book on the operator's own website"]);
  expect(wording('band.placeholder')).toEqual(['想去邊？輸入國家、地區或城市', '想去哪里？输入国家、地区或城市', 'Where to? Enter a country, region or city']);
  expect(wording('card.openedEarlier')).toEqual(['已看過', '已看过', 'Viewed']);
  expect(wording('card.openedLatest')).toEqual(['上次打開', '上次打开', 'Last opened']);
  expect(wording('row.again')).toEqual(['再看一次 ↗', '再看一次 ↗', 'View again ↗']);
  // The add-to-trip control keeps its words (the owner found a bare "+" unclear).
  expect(wording('card.add')).toEqual(['加入行程 +', '加入行程 +', '+ Add to trip']);
});

it('the Cantonese notice reads as the owner approved', () => {
  expect(zhHans['notice.cantonese']).toBe('旅行团一般以粤语进行，详情请向旅行社查询。');
  expect(en['notice.cantonese']).toBe('Tours are normally conducted in Cantonese. Check with the operator.');
});

it('Traditional Chinese says 天 for a length of time (5天, 天數, 休息 2 天) and keeps 日 for calendar days (12月19日, 翌日)', () => {
  for (const [key, text] of Object.entries(zhHant)) {
    // A number, a {placeholder} or 數 after 日 is a length; 日本, 日期, 日子, 節日, 翌日, 日後 and the dates' 日 are not.
    expect(text, key).not.toMatch(/日數/);
    if (!key.startsWith('date.')) expect(text, key).not.toMatch(/(\d|\})\s?日(?![本期子])/);
  }
  expect(zhHant['length.daysNights']).toBe('{days}天{nights}夜');
  expect(zhHant['chain.totalCount']).toBe('{n} 個旅行團 · {d} 天');
  expect(zhHant['date.monthDay']).toBe('{monthName}{day}日');
  expect(zhHant['trip.restNone']).toBe('休息 0 天（翌日出發）');
  // Simplified already says 天 for lengths.
  for (const [key, text] of Object.entries(zhHans)) {
    if (!key.startsWith('date.')) expect(text, key).not.toMatch(/(\d|\})\s?日(?![本期子])|日数/);
  }
});
