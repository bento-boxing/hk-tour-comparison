import { it, expect } from 'vitest';
import {
  tourEndDate, gapWindow, gapBetween, addDays, daysBetween, sanitiseGap, todayInHongKong,
} from './index';

it.each([
  ['2026-12-18', 5, '2026-12-22'],
  ['2026-12-30', 5, '2027-01-03'],   // year boundary
  ['2028-02-27', 5, '2028-03-02'],   // leap year
  ['2027-02-27', 5, '2027-03-03'],   // non-leap year
  ['2026-12-18', 1, '2026-12-18'],   // one-day tour ends the day it starts
])('tourEndDate(%s, %i) → %s', (dep, days, end) => { expect(tourEndDate(dep, days)).toBe(end); });

it.each([
  ['2026-12-22', 1, 3, '2026-12-24', '2026-12-26'],  // the spec's example
  ['2026-12-22', 0, 0, '2026-12-23', '2026-12-23'],  // leave next morning
  ['2026-12-30', 1, 3, '2027-01-01', '2027-01-03'],
  ['2026-12-22', 2, 2, '2026-12-25', '2026-12-25'],
])('gapWindow(%s, %i, %i)', (end, min, max, from, to) => {
  expect(gapWindow(end, min, max)).toEqual({ from, to });
});

it('gapBetween', () => {
  expect(gapBetween('2026-12-22', '2026-12-24')).toBe(1);
  expect(gapBetween('2026-12-22', '2026-12-23')).toBe(0);
  expect(gapBetween('2026-12-22', '2026-12-22')).toBe(-1);
});

it('addDays and daysBetween', () => {
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
});

it.each([
  [1, 3, 1, 3], [5, 1, 1, 5], [-2, 3, 0, 3], [0, 99, 0, 30], [1.7, 3.2, 1, 3],
  ['a', 3, 1, 3], [undefined, undefined, 1, 3], [NaN, 2, 1, 3],
])('sanitiseGap(%j, %j) → %i–%i', (a, b, min, max) => {
  expect(sanitiseGap(a, b)).toEqual({ min, max });
});

it('todayInHongKong uses Hong Kong time', () => {
  expect(todayInHongKong(new Date('2026-11-12T17:30:00Z'))).toBe('2026-11-13'); // 01:30 HKT next day
  expect(todayInHongKong(new Date('2026-11-12T15:59:00Z'))).toBe('2026-11-12');
});
