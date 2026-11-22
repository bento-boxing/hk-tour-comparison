import { addDays, type IsoDate } from '@hktours/core';
import type { DateWindow } from '@hktours/db/read';
import type { DictKey } from './i18n';
import { buildSearchQuery, searchHref, type SearchState } from './search-params';

// A season's page is '/seasons/<id>' in each language ('/seasons/christmas', '/en/seasons/lunar-new-year'): the search
// page with the departure window (the address's `from` and `to`) fixed to the season's days in its current year. The
// address never carries a year, so it keeps its standing from one year to the next; the page moves on to the next
// year by itself once a year's days have passed (currentWindow). These addresses are permanent once indexed.

/** The seasons with a page, in the order the site lists them. */
export const SEASON_IDS = ['christmas', 'lunar-new-year', 'easter'] as const;
export type SeasonId = (typeof SEASON_IDS)[number];

/**
 * Each season's name in the dictionary: in headings, titles and the band's boxes (`name`), and in descriptions
 * (`description`: Simplified Chinese says 春节 there).
 */
export const SEASON_NAME_KEYS: Readonly<Record<SeasonId, { name: DictKey; description: DictKey }>> = {
  christmas: { name: 'season.christmas', description: 'season.christmas.description' },
  'lunar-new-year': { name: 'season.lunar-new-year', description: 'season.lunar-new-year.description' },
  easter: { name: 'season.easter', description: 'season.easter.description' },
};

/** The season an id names, exactly as spelled in SEASON_IDS; undefined for anything else. */
export function seasonFromId(id: string): SeasonId | undefined {
  return SEASON_IDS.find(known => known === id);
}

/** A season's page ('/seasons/christmas'). A path without a language: see localeHref. */
export function seasonPath(id: SeasonId): `/seasons/${SeasonId}` {
  return `/seasons/${id}`;
}

/** One year's days of a season: the departure window its page searches, both days included. */
export interface SeasonWindow extends DateWindow {
  season: SeasonId;
  /** The year it is named by: the December's for Christmas, the new year's for Lunar New Year. */
  year: number;
}

/**
 * The first day of each lunar year (正月初一), 2026 to 2050, as the Hong Kong Observatory's calendar gives it (the
 * calendar reckoned at UTC+8). Checked in seasons.test.ts against an independent reckoning: the day, at UTC+8, of
 * the first new moon on or after 21 January (Meeus, Astronomical Algorithms, chapter 49). No year outside this
 * table is ever guessed: past its end the Lunar New Year page is a 404 and leaves the sitemap (currentWindow).
 */
export const LUNAR_NEW_YEAR_FIRST_DAYS: Readonly<Record<number, IsoDate>> = {
  2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03',
  2031: '2031-01-23', 2032: '2032-02-11', 2033: '2033-01-31', 2034: '2034-02-19', 2035: '2035-02-08',
  2036: '2036-01-28', 2037: '2037-02-15', 2038: '2038-02-04', 2039: '2039-01-24', 2040: '2040-02-12',
  2041: '2041-02-01', 2042: '2042-01-22', 2043: '2043-02-10', 2044: '2044-01-30', 2045: '2045-02-17',
  2046: '2046-02-06', 2047: '2047-01-26', 2048: '2048-02-14', 2049: '2049-02-02', 2050: '2050-01-23',
};

/** The last year LUNAR_NEW_YEAR_FIRST_DAYS knows: after its Lunar New Year days, that page has no window. */
export const LUNAR_NEW_YEAR_LAST_YEAR = Math.max(...Object.keys(LUNAR_NEW_YEAR_FIRST_DAYS).map(Number));

/** Easter Sunday of a year in the Gregorian calendar (the anonymous Gregorian computus, Meeus/Jones/Butcher). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * A season's days in `year`, or null when they are not known (a Lunar New Year outside the table):
 * - Christmas: departures 19 to 27 December;
 * - Lunar New Year: from 3 days before its first day to 4 days after it (2027: 3 to 10 February);
 * - Easter: from 4 days before Easter Sunday to 2 days after it (2027: 24 to 30 March).
 */
export function seasonWindow(season: SeasonId, year: number): SeasonWindow | null {
  switch (season) {
    case 'christmas':
      return { season, year, from: `${year}-12-19`, to: `${year}-12-27` };
    case 'lunar-new-year': {
      const first = LUNAR_NEW_YEAR_FIRST_DAYS[year];
      return first === undefined ? null : { season, year, from: addDays(first, -3), to: addDays(first, 4) };
    }
    case 'easter': {
      const sunday = easterSunday(year);
      return { season, year, from: addDays(sunday, -4), to: addDays(sunday, 2) };
    }
  }
}

/**
 * The season's window its page is about on `today` (Hong Kong's date, as every page reads it: todayInHongKong): the
 * first whose last day is today or later, this year's or else next year's. So from 28 December the Christmas page is
 * about the next Christmas. Null when that year's days are not known (past the Lunar New Year table, or a year before
 * it): the page is then a 404 and is not in the sitemap.
 */
export function currentWindow(season: SeasonId, today: IsoDate): SeasonWindow | null {
  const year = Number(today.slice(0, 4));
  const thisYear = seasonWindow(season, year);
  if (thisYear === null) return null;
  return thisYear.to >= today ? thisYear : seasonWindow(season, year + 1);
}

/** Every season's current window on `today`, in SEASON_IDS order; a season without one is left out. */
export function currentWindows(today: IsoDate): SeasonWindow[] {
  return SEASON_IDS.flatMap(season => currentWindow(season, today) ?? []);
}

/** True when a search state's departure window is exactly the season's days. */
export function isSeasonState(window: SeasonWindow, state: SearchState): boolean {
  return state.filters.dateFrom === window.from && state.filters.dateTo === window.to;
}

/**
 * The address of a search state on a season's page. With the season's own days as its departure window, it stays on
 * the page: the page's path, with every other filter in the query (the destination among them, as `dest`), and never
 * `from` or `to`. With any other departure window (other dates, or none), it is the search page's address for that
 * state (searchHref: a destination's page, or '/'), as choosing another destination on a destination's page leaves
 * it. A path without a language: see localeHref.
 */
export function seasonSearchHref(window: SeasonWindow, state: SearchState): string {
  if (!isSeasonState(window, state)) return searchHref(state);
  const query = buildSearchQuery(state);
  query.delete('from');
  query.delete('to');
  const path = seasonPath(window.season);
  // Not query.size: Safari before 17, Chrome before 113 and Firefox before 112 lack it (undefined there).
  const q = query.toString();
  return q ? `${path}?${q}` : path;
}
