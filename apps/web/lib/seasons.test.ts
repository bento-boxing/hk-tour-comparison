import { describe, it, expect } from 'vitest';
import { addDays, places } from '@hktours/core';
import {
  LUNAR_NEW_YEAR_FIRST_DAYS, LUNAR_NEW_YEAR_LAST_YEAR, SEASON_IDS, currentWindow, currentWindows, easterSunday,
  seasonFromId, seasonPath, seasonSearchHref, seasonWindow,
} from './seasons';
import { parseSearchParams, withFilters } from './search-params';

// Every date here is passed in: nothing reads the clock.

describe('the seasons and their addresses', () => {
  it('has three seasons, each at /seasons/<id> without a year', () => {
    expect(SEASON_IDS).toEqual(['christmas', 'lunar-new-year', 'easter']);
    expect(SEASON_IDS.map(seasonPath)).toEqual(['/seasons/christmas', '/seasons/lunar-new-year', '/seasons/easter']);
  });

  it.each(['christmas', 'lunar-new-year', 'easter'])('%s names its season', id => {
    expect(seasonFromId(id)).toBe(id);
  });

  it.each(['Christmas', 'xmas', 'christmas-2026', 'new-year', 'easter ', '', 'constructor', 'toString'])('%j names none', id => {
    expect(seasonFromId(id)).toBeUndefined();
  });
});

describe('Easter Sunday (the Gregorian computus)', () => {
  it.each([
    [1818, '1818-03-22'], [1943, '1943-04-25'], [2000, '2000-04-23'], [2008, '2008-03-23'], [2011, '2011-04-24'],
    [2019, '2019-04-21'], [2024, '2024-03-31'], [2025, '2025-04-20'], [2026, '2026-04-05'], [2027, '2027-03-28'],
    [2028, '2028-04-16'], [2029, '2029-04-01'], [2030, '2030-04-21'], [2038, '2038-04-25'], [2285, '2285-03-22'],
  ])('%i: %s', (year, sunday) => {
    expect(easterSunday(year)).toBe(sunday);
  });

  it('is always a Sunday between 22 March and 25 April', () => {
    for (let year = 1900; year <= 2200; year++) {
      const sunday = easterSunday(year);
      expect(new Date(`${sunday}T00:00:00Z`).getUTCDay(), sunday).toBe(0);
      expect(sunday.slice(5) >= '03-22' && sunday.slice(5) <= '04-25', sunday).toBe(true);
    }
  });
});

describe('each season\'s days in a year', () => {
  it('Christmas: 19 to 27 December', () => {
    expect(seasonWindow('christmas', 2026)).toEqual({ season: 'christmas', year: 2026, from: '2026-12-19', to: '2026-12-27' });
  });

  it('Lunar New Year: 3 days before its first day to 4 days after (2027: first day 6 February, so 3 to 10 February)', () => {
    expect(seasonWindow('lunar-new-year', 2027)).toEqual({ season: 'lunar-new-year', year: 2027, from: '2027-02-03', to: '2027-02-10' });
    // Across a month's end: 2028's first day is 26 January.
    expect(seasonWindow('lunar-new-year', 2028)).toEqual({ season: 'lunar-new-year', year: 2028, from: '2028-01-23', to: '2028-01-30' });
  });

  it('Easter: 4 days before Easter Sunday to 2 days after (2027: Sunday 28 March, so 24 to 30 March)', () => {
    expect(seasonWindow('easter', 2027)).toEqual({ season: 'easter', year: 2027, from: '2027-03-24', to: '2027-03-30' });
    // Across a month's end: 2029's Sunday is 1 April.
    expect(seasonWindow('easter', 2029)).toEqual({ season: 'easter', year: 2029, from: '2029-03-28', to: '2029-04-03' });
  });

  it('a Lunar New Year outside the table is never guessed', () => {
    expect(seasonWindow('lunar-new-year', 2025)).toBeNull();
    expect(seasonWindow('lunar-new-year', LUNAR_NEW_YEAR_LAST_YEAR + 1)).toBeNull();
  });
});

describe('the current window: the first whose last day is today or later (Hong Kong\'s today, passed in)', () => {
  it.each([
    ['before it', '2026-11-22', 2026],
    ['on its first day', '2026-12-19', 2026],
    ['inside it', '2026-12-24', 2026],
    ['on its last day', '2026-12-27', 2026],
    ['the day after it: rolled forward', '2026-12-28', 2027],
    ['on New Year\'s Day', '2027-01-01', 2027],
  ])('Christmas %s (%s) is that of %i', (_, today, year) => {
    expect(currentWindow('christmas', today)).toEqual(seasonWindow('christmas', year));
  });

  it.each([
    ['before it', '2026-11-22', 2027],
    ['on its first day', '2027-02-03', 2027],
    ['on its last day', '2027-02-10', 2027],
    ['the day after it: rolled forward', '2027-02-11', 2028],
    ['before this year\'s, early in the year', '2026-01-05', 2026],
  ])('Lunar New Year %s (%s) is that of %i', (_, today, year) => {
    expect(currentWindow('lunar-new-year', today)).toEqual(seasonWindow('lunar-new-year', year));
  });

  it.each([
    ['before it', '2026-11-22', 2027],
    ['inside it', '2027-03-28', 2027],
    ['on its last day', '2027-03-30', 2027],
    ['the day after it: rolled forward', '2027-03-31', 2028],
  ])('Easter %s (%s) is that of %i', (_, today, year) => {
    expect(currentWindow('easter', today)).toEqual(seasonWindow('easter', year));
  });

  it(`the Lunar New Year table ends with ${LUNAR_NEW_YEAR_LAST_YEAR}: after that year's days the page has no window`, () => {
    expect(LUNAR_NEW_YEAR_LAST_YEAR).toBe(2050);
    const last = seasonWindow('lunar-new-year', LUNAR_NEW_YEAR_LAST_YEAR)!;
    expect(currentWindow('lunar-new-year', last.to)).toEqual(last);
    expect(currentWindow('lunar-new-year', addDays(last.to, 1))).toBeNull();
    expect(currentWindow('lunar-new-year', `${LUNAR_NEW_YEAR_LAST_YEAR + 1}-01-01`)).toBeNull();
    // A year before the table: not guessed either.
    expect(currentWindow('lunar-new-year', '2025-01-02')).toBeNull();
    // The other two go on.
    expect(currentWindows(addDays(last.to, 1)).map(w => w.season)).toEqual(['christmas', 'easter']);
  });

  it('currentWindows gives the three in order', () => {
    expect(currentWindows('2026-11-22')).toEqual([
      { season: 'christmas', year: 2026, from: '2026-12-19', to: '2026-12-27' },
      { season: 'lunar-new-year', year: 2027, from: '2027-02-03', to: '2027-02-10' },
      { season: 'easter', year: 2027, from: '2027-03-24', to: '2027-03-30' },
    ]);
  });
});

/*
 * An independent check of the Lunar New Year table: the first day of a lunar year is the day, in China's time (UTC+8,
 * which the Hong Kong Observatory's calendar uses), of the first new moon on or after 21 January (it falls by 20
 * February; true for every year here). The new moons are reckoned with Meeus's method (Astronomical Algorithms, 2nd ed.,
 * chapter 49, with its periodic and planetary terms), good to well under a minute in this century, then moved from
 * dynamical time to UT by ΔT (about 70 s now). (The ICU Chinese calendar in Node is not used: its lunar positions are
 * coarser, and it puts 2027 on 7 February and 2030 on 2 February, new moons that fall a few minutes either side of
 * midnight in China.)
 */
const RAD = Math.PI / 180;
const sin = (deg: number) => Math.sin(deg * RAD);

/** The Julian Ephemeris Day of mean-lunation number k's new moon (k = 0: 6 January 2000). */
function newMoonJde(k: number): number {
  const T = k / 1236.85;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T ** 2 - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const E = 1 - 0.002516 * T - 0.0000074 * T ** 2;
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T ** 2 - 0.00000011 * T ** 3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T ** 2 + 0.00001238 * T ** 3 - 0.000000058 * T ** 4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T ** 2 - 0.00000227 * T ** 3 + 0.000000011 * T ** 4;
  const O = 124.7746 - 1.56375588 * k + 0.0020672 * T ** 2 + 0.00000215 * T ** 3;
  jde += -0.4072 * sin(Mp) + 0.17241 * E * sin(M) + 0.01608 * sin(2 * Mp) + 0.01039 * sin(2 * F)
    + 0.00739 * E * sin(Mp - M) - 0.00514 * E * sin(Mp + M) + 0.00208 * E * E * sin(2 * M)
    - 0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F) + 0.00056 * E * sin(2 * Mp + M)
    - 0.00042 * sin(3 * Mp) + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F)
    - 0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(O) - 0.00007 * sin(Mp + 2 * M)
    + 0.00004 * sin(2 * Mp - 2 * F) + 0.00004 * sin(3 * M) + 0.00003 * sin(Mp + M - 2 * F)
    + 0.00003 * sin(2 * Mp + 2 * F) - 0.00003 * sin(Mp + M + 2 * F) + 0.00003 * sin(Mp - M + 2 * F)
    - 0.00002 * sin(Mp - M - 2 * F) - 0.00002 * sin(3 * Mp + M) + 0.00002 * sin(4 * Mp);
  const A = [
    299.77 + 0.107408 * k - 0.009173 * T ** 2, 251.88 + 0.016321 * k, 251.83 + 26.651886 * k, 349.42 + 36.412478 * k,
    84.66 + 18.206239 * k, 141.74 + 53.303771 * k, 207.14 + 2.453732 * k, 154.84 + 7.30686 * k, 34.52 + 27.261239 * k,
    207.19 + 0.121824 * k, 291.34 + 1.844379 * k, 161.72 + 24.198154 * k, 239.56 + 25.513099 * k, 331.55 + 3.592518 * k,
  ];
  const W = [0.000325, 0.000165, 0.000164, 0.000126, 0.00011, 0.000062, 0.00006, 0.000056, 0.000047, 0.000042, 0.00004, 0.000037, 0.000035, 0.000023];
  return jde + A.reduce((sum, a, i) => sum + W[i] * sin(a), 0);
}

/** ΔT (TT − UT) in seconds, near enough for these years (Espenak and Meeus's polynomial for 2005–2050). */
const deltaT = (year: number) => 62.92 + 0.32217 * (year - 2000) + 0.005589 * (year - 2000) ** 2;

/** A new moon's date in China's time (UTC+8), from its JDE. */
function chinaDate(jde: number, year: number): string {
  const unixMs = (jde - 2440587.5) * 86_400_000 - deltaT(year) * 1000;
  return new Date(unixMs + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** The first day of `year`'s lunar year: the first new moon (at UTC+8) on or after 21 January. */
function reckonedFirstDay(year: number): string {
  const k0 = Math.floor((year + 0.04 - 2000) * 12.3685);
  const first = [k0 - 1, k0, k0 + 1, k0 + 2].map(k => chinaDate(newMoonJde(k), year)).find(d => d >= `${year}-01-21`)!;
  expect(first <= `${year}-02-20`, `${year}: ${first}`).toBe(true);
  return first;
}

describe('the Lunar New Year table, checked against the new moons', () => {
  it('reckons Meeus\'s worked example right (example 49.a: the new moon of February 1977, JDE 2443192.65118)', () => {
    expect(newMoonJde(-283)).toBeCloseTo(2443192.65118, 4);
  });

  it('covers every year from 2026 to its last, in order, with no gap', () => {
    const years = Object.keys(LUNAR_NEW_YEAR_FIRST_DAYS).map(Number);
    expect(years).toEqual(Array.from({ length: LUNAR_NEW_YEAR_LAST_YEAR - 2026 + 1 }, (_, i) => 2026 + i));
    expect(years.length).toBeGreaterThanOrEqual(15); // at least 2027 to 2040
  });

  it.each(Object.entries(LUNAR_NEW_YEAR_FIRST_DAYS))('%s: %s is the day of the new moon at UTC+8', (year, first) => {
    expect(reckonedFirstDay(Number(year))).toBe(first);
  });
});

describe('a season page\'s addresses (seasonSearchHref)', () => {
  const christmas = seasonWindow('christmas', 2026)!;
  const onPage = (query: Record<string, string>) =>
    parseSearchParams({ ...query, from: christmas.from, to: christmas.to }, places);

  it('with the season\'s own days it stays on the page, every other filter in the query, the destination as dest, never from or to', () => {
    expect(seasonSearchHref(christmas, onPage({}))).toBe('/seasons/christmas');
    expect(seasonSearchHref(christmas, onPage({ dest: 'japan', dmin: '5', sort: 'days', page: '2' })))
      .toBe('/seasons/christmas?dest=japan&dmin=5&sort=days&page=2');
    expect(seasonSearchHref(christmas, onPage({ tfrom: '2026-12-18', tto: '2026-12-31' })))
      .toBe('/seasons/christmas?tfrom=2026-12-18&tto=2026-12-31');
  });

  it('with other dates, or none, it leaves for the search page with them (a destination\'s page when one is chosen)', () => {
    const state = onPage({ dest: 'japan', dmin: '5' });
    expect(seasonSearchHref(christmas, withFilters(state, { dateFrom: '2026-12-20' })))
      .toBe('/tours/japan?from=2026-12-20&to=2026-12-27&dmin=5');
    expect(seasonSearchHref(christmas, withFilters(state, { dateFrom: undefined, dateTo: undefined }))).toBe('/tours/japan?dmin=5');
    expect(seasonSearchHref(christmas, withFilters(onPage({}), { dateTo: '2026-12-31' }))).toBe('/?from=2026-12-19&to=2026-12-31');
  });
});
