import { it, expect } from 'vitest';
import { formatPrice, formatChipDate, formatLength, formatUpdated } from './format';
import { makeT } from './i18n';

const tZh = makeT('zh-Hant');

it('formatPrice', () => { expect(formatPrice(7999)).toBe('HK$7,999'); expect(formatPrice(12500)).toBe('HK$12,500'); });

it('formatChipDate', () => {
  expect(formatChipDate('2026-12-18', '2026-11-12')).toBe('12/18');
  expect(formatChipDate('2027-01-03', '2026-11-12')).toBe('2027/1/3');
});

it('formatLength', () => { expect(formatLength(5, 4, tZh)).toBe('5日4夜'); expect(formatLength(5, null, tZh)).toBe('5日'); });

it('formatUpdated uses Hong Kong time', () => {
  expect(formatUpdated('2026-11-11T19:10:00Z', '2026-11-12', tZh)).toBe('更新：今日 03:10');
  expect(formatUpdated('2026-11-10T19:10:00Z', '2026-11-12', tZh)).toBe('更新：11月11日 03:10');
});

it('formatUpdated in each language', () => {
  expect(formatUpdated('2026-11-10T19:10:00Z', '2026-11-12', makeT('zh-Hans'))).toBe('更新：11月11日 03:10');
  expect(formatUpdated('2026-11-11T19:10:00Z', '2026-11-12', makeT('zh-Hans'))).toBe('更新：今天 03:10');
  expect(formatUpdated('2026-11-10T19:10:00Z', '2026-11-12', makeT('en'))).toBe('Updated 11 Nov at 03:10');
  expect(formatUpdated('2026-11-11T19:10:00Z', '2026-11-12', makeT('en'))).toBe('Updated today at 03:10');
});

it('formatLength in each language, HKD prices throughout', () => {
  expect(formatLength(5, 4, makeT('zh-Hans'))).toBe('5天4晚');
  expect(formatLength(1, null, makeT('en'))).toBe('1 day');
  expect(formatLength(2, 1, makeT('en'))).toBe('2 days, 1 night');
  expect(formatPrice(7999)).toBe('HK$7,999');
});
