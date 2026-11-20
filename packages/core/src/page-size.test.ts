import { it, expect } from 'vitest';
import { isPageSize, PAGE_SIZE, PAGE_SIZES } from './page-size';

it('offers 24, 48 and 96 rows per page, 24 by default; nothing else is a page size', () => {
  expect(PAGE_SIZES).toEqual([24, 48, 96]);
  expect(PAGE_SIZE).toBe(24);
  expect(PAGE_SIZES.every(isPageSize)).toBe(true);
  for (const odd of [0, 25, 47, 100, -24, 24.5, NaN, '24', null, undefined]) expect(isPageSize(odd), String(odd)).toBe(false);
});
