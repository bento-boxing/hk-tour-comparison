import { it, expect } from 'vitest';
import { formatPrice, formatChipDate, formatLength, formatUpdated } from './format';
import { translate, type T } from './i18n';

const tZh: T = (key, vars) => translate('zh-Hant', key, vars);

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
