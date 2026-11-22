import { describe, it, expect } from 'vitest';
import { places } from '@hktours/core';
import type { DestinationCount, DestinationCounts } from '@hktours/db/read';
import { makeT } from './i18n';
import { bandHref, bandRows, REGIONS_PHONE, REGIONS_WIDE, WIDE_BOXES } from './band-rows';
import { parseSearchParams } from './search-params';
import { seasonWindow } from './seasons';
import type { SeasonCount } from './season-counts';

// Task 69 (drawing W3): the band's two rows, worked out from a page's state and invented counts. Every address is a
// path without a language; the pages put the language on (and the band tests check that).

const line = (countryId: string, regionId: string | null, tours: number): DestinationCount => ({ countryId, regionId, tours, operators: 1 });

/** Site-wide: Japan with all nine regions, China with eleven provinces, Korea, Taiwan, Macau (its only region), more. */
const site: DestinationCounts = {
  all: { tours: 500, operators: 6 },
  destinations: [
    line('china', null, 120),
    ...['guangdong', 'beijing', 'shanghai', 'zhejiang', 'jiangsu', 'sichuan', 'yunnan', 'guangxi', 'fujian', 'hunan', 'xinjiang']
      .map((r, i) => line('china', `china-${r}`, 40 - i * 3)),
    line('japan', null, 100),
    line('japan', 'japan-kansai', 30), line('japan', 'japan-kanto', 25), line('japan', 'japan-hokkaido', 20),
    line('japan', 'japan-kyushu', 15), line('japan', 'japan-chubu', 10), line('japan', 'japan-okinawa', 8),
    line('japan', 'japan-tohoku', 6), line('japan', 'japan-chugoku', 4), line('japan', 'japan-shikoku', 2),
    line('korea', null, 80), line('korea', 'korea-seoul', 80),
    line('macau', null, 70), line('macau', 'macau-macau', 70),
    line('taiwan', null, 60), line('taiwan', 'taiwan-north', 60),
    line('thailand', null, 50), line('vietnam', null, 40), line('germany', null, 30), line('france', null, 20),
  ],
};

const christmas = seasonWindow('christmas', 2026)!;
const newYear = seasonWindow('lunar-new-year', 2027)!;
const easter = seasonWindow('easter', 2027)!;
/** The seasons: Christmas with Japan (and some of its regions) and Korea; New Year with China only; Easter empty. */
const seasons: SeasonCount[] = [
  { window: christmas, count: { tours: 30, operators: 3, destinations: [
    line('japan', null, 12), line('japan', 'japan-hokkaido', 9), line('japan', 'japan-kansai', 3), line('japan', 'japan-kanto', 3),
    line('korea', null, 18), line('korea', 'korea-seoul', 18),
  ] } },
  { window: newYear, count: { tours: 7, operators: 1, destinations: [line('china', null, 7), line('china', 'china-guangdong', 7)] } },
  { window: easter, count: { tours: 0, operators: 0, destinations: [] } },
];

const t = makeT('zh-Hant');
const stateOf = (query: Record<string, string>) => parseSearchParams(query, places);
const rowsOf = (query: Record<string, string>) => bandRows(t, stateOf(query), site, seasons);
const summary = (boxes: { key: string; tours: number; path: string | null; chosen: boolean }[]) => boxes.map(b => [b.key, b.tours, b.path, b.chosen]);

describe('nothing chosen (the home page)', () => {
  const { where, when } = rowsOf({});

  it('row 1: today\'s top destinations, site-wide, each to its page (no regions: none of them on phones)', () => {
    expect(where.label).toBe('熱門目的地');
    expect(where.regions).toBe(false);
    expect(summary(where.boxes)).toEqual([
      ['china', 120, '/tours/china', false], ['japan', 100, '/tours/japan', false], ['korea', 80, '/tours/korea', false],
      ['macau', 70, '/tours/macau', false], ['taiwan', 60, '/tours/taiwan', false], ['thailand', 50, '/tours/thailand', false],
      ['vietnam', 40, '/tours/vietnam', false],
    ]);
    expect(where.boxes).toHaveLength(WIDE_BOXES);
    expect(where.moreRegions).toBeNull();
  });

  it('the phone search screen: the top eight, site-wide, and the site-wide counts by destination id', () => {
    const { screen } = rowsOf({});
    expect(screen.popular).toEqual(['china', 'japan', 'korea', 'macau', 'taiwan', 'thailand', 'vietnam', 'germany']);
    expect(screen.tours).toMatchObject({ china: 120, 'china-guangdong': 40, japan: 100, 'japan-kansai': 30, france: 20 });
  });

  it('row 2: the seasons with tours, soonest first, site-wide, each to its page', () => {
    expect(summary(when)).toEqual([['christmas', 30, '/seasons/christmas', false], ['lunar-new-year', 7, '/seasons/lunar-new-year', false]]);
  });
});

describe('a country chosen (/tours/japan)', () => {
  const { where, when } = rowsOf({ dest: 'japan', dmin: '5', sort: 'days', page: '3' });

  it('row 1: the country chosen (pressing it goes home), then its regions most tours first, each keeping the other filters', () => {
    expect(where.label).toBe('日本地區');
    expect(where.regions).toBe(true);
    expect(summary(where.boxes)).toEqual([
      ['japan', 100, '/?dmin=5&sort=days', true],
      ['japan-kansai', 30, '/tours/japan-kansai?dmin=5&sort=days', false], ['japan-kanto', 25, '/tours/japan-kanto?dmin=5&sort=days', false],
      ['japan-hokkaido', 20, '/tours/japan-hokkaido?dmin=5&sort=days', false], ['japan-kyushu', 15, '/tours/japan-kyushu?dmin=5&sort=days', false],
      ['japan-chubu', 10, '/tours/japan-chubu?dmin=5&sort=days', false], ['japan-okinawa', 8, '/tours/japan-okinawa?dmin=5&sort=days', false],
      ['japan-tohoku', 6, '/tours/japan-tohoku?dmin=5&sort=days', false], ['japan-chugoku', 4, '/tours/japan-chugoku?dmin=5&sort=days', false],
      ['japan-shikoku', 2, '/tours/japan-shikoku?dmin=5&sort=days', false],
    ]);
  });

  it('nine regions: all of them on wide screens; on phones the first three, the others behind the disclosure', () => {
    expect(where.boxes.slice(1).map(b => b.moreOnWide)).toEqual(Array(9).fill(false));
    expect(where.boxes.slice(1).map(b => b.moreOnPhone)).toEqual(where.boxes.slice(1).map((_, i) => i >= REGIONS_PHONE));
    expect(where.moreRegions).toEqual({ n: 9, onWide: false, onPhone: true });
  });

  it('four regions or fewer besides a chosen one: all of them on phones, no disclosure', () => {
    // Korea's one listed region; Japan with four regions listed: none behind a disclosure.
    expect(rowsOf({ dest: 'korea' }).where.moreRegions).toBeNull();
    const japanWith = (min: number): typeof site => ({ ...site, destinations: site.destinations.filter(l => l.countryId !== 'japan' || l.tours >= min) });
    const four = bandRows(t, stateOf({ dest: 'japan' }), japanWith(15), seasons).where;
    expect(four.boxes.slice(1).map(b => b.moreOnPhone)).toEqual([false, false, false, false]);
    expect(four.moreRegions).toBeNull();
    // Five regions, one of them chosen: the four others all show.
    const chosen = bandRows(t, stateOf({ dest: 'japan-kanto' }), japanWith(10), seasons).where;
    expect(chosen.boxes.slice(1).map(b => [b.key, b.moreOnPhone])).toEqual([
      ['japan-kansai', false], ['japan-kanto', false], ['japan-hokkaido', false], ['japan-kyushu', false], ['japan-chubu', false],
    ]);
    expect(chosen.moreRegions).toBeNull();
  });

  it('row 2: each season counted for the country (a season without its tours is faded, no link), keeping the country', () => {
    expect(summary(when)).toEqual([
      ['christmas', 12, '/seasons/christmas?dest=japan&dmin=5&sort=days', false],
      ['lunar-new-year', 0, null, false],
    ]);
  });
});

it('more than nine regions: eight on wide screens and the disclosure there too', () => {
  const { where } = rowsOf({ dest: 'china' });
  expect(where.boxes).toHaveLength(12);
  expect(where.boxes.slice(1).map(b => b.moreOnWide)).toEqual(where.boxes.slice(1).map((_, i) => i >= REGIONS_WIDE));
  expect(where.moreRegions).toEqual({ n: 11, onWide: true, onPhone: true });
});

describe('a region chosen (/tours/japan-shikoku)', () => {
  const { where } = rowsOf({ dest: 'japan-shikoku' });

  it('the country\'s row: the country first (a way to it), then the chosen region first among the regions', () => {
    expect(where.label).toBe('日本地區');
    expect(summary(where.boxes).slice(0, 4)).toEqual([
      ['japan', 100, '/tours/japan', false],
      ['japan-shikoku', 2, '/tours/japan', true], // its ✕ goes back to the country
      ['japan-kansai', 30, '/tours/japan-kansai', false], ['japan-kanto', 25, '/tours/japan-kanto', false],
    ]);
    // On phones the chosen region is in the row of chosen boxes: the regions row is the others, three and the disclosure.
    expect(where.boxes.slice(1).map(b => b.moreOnPhone)).toEqual([false, false, false, false, true, true, true, true, true]);
    expect(where.moreRegions).toEqual({ n: 9, onWide: false, onPhone: true });
  });

  it('a region already among the first three keeps its place', () => {
    expect(rowsOf({ dest: 'japan-kanto' }).where.boxes.slice(1, 3).map(b => [b.key, b.chosen])).toEqual([['japan-kansai', false], ['japan-kanto', true]]);
  });
});

it('a destination the rules do not fit (a country with no region pages): its box chosen first, then the top destinations without it', () => {
  const { where } = rowsOf({ dest: 'macau' });
  expect(where.label).toBe('熱門目的地');
  expect(summary(where.boxes)).toEqual([
    ['macau', 70, '/', true], ['china', 120, '/tours/china', false], ['japan', 100, '/tours/japan', false],
    ['korea', 80, '/tours/korea', false], ['taiwan', 60, '/tours/taiwan', false], ['thailand', 50, '/tours/thailand', false],
    ['vietnam', 40, '/tours/vietnam', false],
  ]);
  expect(where.regions).toBe(false);
  expect(where.moreRegions).toBeNull();
});

describe('a season chosen (/seasons/christmas)', () => {
  const query = { from: christmas.from, to: christmas.to };

  it('row 1: the same destinations, counted in the season (none there: faded, no link), each keeping the season', () => {
    const { where } = rowsOf(query);
    expect(summary(where.boxes).slice(0, 4)).toEqual([
      ['china', 0, null, false], ['japan', 12, '/seasons/christmas?dest=japan', false],
      ['korea', 18, '/seasons/christmas?dest=korea', false], ['macau', 0, null, false],
    ]);
  });

  it('the phone search screen: the same top eight, counted in the season', () => {
    const { screen } = rowsOf(query);
    expect(screen.popular[0]).toBe('china');
    expect(screen.tours).toEqual({ japan: 12, 'japan-hokkaido': 9, 'japan-kansai': 3, 'japan-kanto': 3, korea: 18, 'korea-seoul': 18 });
  });

  it('row 2: the season chosen (pressing it goes home), the others to their own pages', () => {
    expect(summary(rowsOf(query).when)).toEqual([['christmas', 30, '/', true], ['lunar-new-year', 7, '/seasons/lunar-new-year', false]]);
  });

  it('an empty season\'s page still shows its own box, chosen', () => {
    const { when } = rowsOf({ from: easter.from, to: easter.to });
    expect(summary(when)).toEqual([
      ['christmas', 30, '/seasons/christmas', false], ['lunar-new-year', 7, '/seasons/lunar-new-year', false], ['easter', 0, '/', true],
    ]);
  });
});

describe('both chosen (/seasons/christmas?dest=japan)', () => {
  const { where, when } = rowsOf({ dest: 'japan', from: christmas.from, to: christmas.to, pmax: '9000' });

  it('row 1: the country chosen (pressing it keeps the season), its regions counted in the season, ordered by that (ties: site-wide order)', () => {
    expect(summary(where.boxes).slice(0, 5)).toEqual([
      ['japan', 12, '/seasons/christmas?pmax=9000', true],
      ['japan-hokkaido', 9, '/seasons/christmas?dest=japan-hokkaido&pmax=9000', false],
      ['japan-kansai', 3, '/seasons/christmas?dest=japan-kansai&pmax=9000', false],
      ['japan-kanto', 3, '/seasons/christmas?dest=japan-kanto&pmax=9000', false],
      ['japan-kyushu', 0, null, false],
    ]);
  });

  it('row 2: the season chosen (pressing it keeps the country: its page), the others counted for the country', () => {
    expect(summary(when)).toEqual([['christmas', 12, '/tours/japan?pmax=9000', true], ['lunar-new-year', 0, null, false]]);
  });
});

it('bandHref: a state whose departure window is a season\'s days is that season\'s page; any other, the search page\'s', () => {
  const windows = seasons.map(s => s.window);
  expect(bandHref(stateOf({ dest: 'japan', from: newYear.from, to: newYear.to, dmin: '3' }), windows)).toBe('/seasons/lunar-new-year?dest=japan&dmin=3');
  expect(bandHref(stateOf({ dest: 'japan', from: newYear.from, to: '2027-03-01' }), windows)).toBe(`/tours/japan?from=${newYear.from}&to=2027-03-01`);
  expect(bandHref(stateOf({}), windows)).toBe('/');
});

it('in English: the row\'s label names the country', () => {
  expect(bandRows(makeT('en'), stateOf({ dest: 'japan' }), site, seasons).where.label).toBe('Regions of Japan');
  expect(bandRows(makeT('zh-Hans'), stateOf({ dest: 'japan' }), site, seasons).where.label).toBe('日本地区');
});
