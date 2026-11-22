import { it, expect } from 'vitest';
import { places } from '@hktours/core';
import {
  DAY_PRESETS, activeFilterCount, clearedState, draftOf, monthWindow, sameSearch, sheetSeasons, stateFromDraft, type SheetSections,
} from './filter-sheet';
import type { SeasonCount } from './season-counts';
import { seasonWindow } from './seasons';
import { buildSearchQuery, type SearchState } from './search-params';

const ALL: SheetSections = { dates: true, operators: true, exclude: false };
const japan = { countryId: 'japan', regionId: null };
const query = (s: SearchState) => buildSearchQuery(s).toString();

it('the badge counts one per section that is on: a pair of dates, a range or several operators are one each', () => {
  const none: SearchState = { filters: { destination: japan }, sort: 'days', page: 2 };
  expect(activeFilterCount(none, ALL)).toBe(0); // the destination and the order are not filters of the sheet
  const many: SearchState = {
    filters: {
      dateFrom: '2026-12-01', dateTo: '2026-12-31', travelTo: '2027-01-10', daysMin: 3, daysMax: 5, priceMax: 3000,
      operators: ['egl', 'jetour'], excludeCountryIds: ['japan'],
    },
    sort: 'price', page: 1,
  };
  expect(activeFilterCount(many, ALL)).toBe(6 - 1); // exclusions are not a section here
  expect(activeFilterCount(many, { dates: false, operators: true, exclude: true })).toBe(4); // the trip page's sections
});

it('a season page\'s own days and an operator page\'s own operator are not counted', () => {
  const christmas = seasonWindow('christmas', 2026)!;
  const onSeason: SearchState = { filters: { dateFrom: christmas.from, dateTo: christmas.to, daysMin: 4 }, sort: 'price', page: 1 };
  expect(activeFilterCount(onSeason, ALL, christmas)).toBe(1);
  expect(activeFilterCount({ ...onSeason, filters: { ...onSeason.filters, dateTo: '2026-12-31' } }, ALL, christmas)).toBe(2);
  const onOperator: SearchState = { filters: { operators: ['egl'] }, sort: 'price', page: 1 };
  expect(activeFilterCount(onOperator, { dates: true, operators: false, exclude: false })).toBe(0);
});

it('清除全部 leaves the destination, the order, the rows per page and what the path fixes', () => {
  const christmas = seasonWindow('christmas', 2026)!;
  const state: SearchState = {
    filters: {
      destination: japan, dateFrom: '2026-12-20', dateTo: '2026-12-31', travelFrom: '2026-12-18', daysMin: 3, priceMax: 9000,
      operators: ['egl'],
    },
    sort: 'days', page: 4, size: 48,
  };
  expect(query(clearedState(state, ALL))).toBe('dest=japan&sort=days&size=48');
  expect(query(clearedState(state, ALL, christmas))).toBe('dest=japan&from=2026-12-19&to=2026-12-27&sort=days&size=48');
  expect(query(clearedState(state, { dates: true, operators: false, exclude: false }))).toBe('dest=japan&op=egl&sort=days&size=48');
});

it('the fields become the next state through the address rules, back on page 1, the rest kept', () => {
  const state: SearchState = { filters: { destination: japan, daysMin: 9 }, sort: 'days', page: 3 };
  const draft = {
    ...draftOf(state),
    from: '2027-01-10', to: '2026-12-01', // reversed: swapped, as the wide date pill does
    dmin: '8', dmax: '3', // reversed: swapped by the address rules
    pmin: '', pmax: ' 5000 ',
    tfrom: '2026-13-40', // not a date: dropped
  };
  const next = stateFromDraft(state, { ...draft, op: ['jetour', 'egl'] }, ALL, places); // operators in the site's order
  expect(query(next)).toBe('dest=japan&from=2026-12-01&to=2027-01-10&dmin=3&dmax=8&pmax=5000&op=egl%2Cjetour&sort=days');
  expect(next.page).toBe(1);
  // Out of range: dropped, as a reload would.
  expect(query(stateFromDraft(state, { ...draftOf(state), dmin: '0', pmax: '99999999' }, ALL, places))).toBe('dest=japan&sort=days');
});

it('a section the page does not have is left as it is (the operator page\'s operator, the trip page\'s dates)', () => {
  const state: SearchState = { filters: { operators: ['egl'], excludeCountryIds: ['japan'] }, sort: 'price', page: 1 };
  const draft = { ...draftOf(state), op: [], ex: [], from: '2026-12-01' };
  expect(query(stateFromDraft(state, draft, { dates: false, operators: false, exclude: false }, places))).toBe('ex=japan&op=egl');
  expect(query(stateFromDraft(state, draft, { dates: false, operators: false, exclude: true }, places))).toBe('op=egl');
});

it('an unchanged sheet gives the same search (no navigation)', () => {
  const state: SearchState = { filters: { daysMin: 3, daysMax: 5, operators: ['egl'] }, sort: 'date', page: 2 };
  expect(sameSearch(stateFromDraft(state, draftOf(state), ALL, places), { ...state, page: 1 })).toBe(true);
  expect(sameSearch(stateFromDraft(state, { ...draftOf(state), dmax: '6' }, ALL, places), state)).toBe(false);
});

it('this month and next month are Hong Kong calendar months from the page\'s today', () => {
  expect(monthWindow('2026-11-22', 0)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  expect(monthWindow('2026-11-22', 1)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  expect(monthWindow('2026-12-31', 1)).toEqual({ from: '2027-01-01', to: '2027-01-31' });
  expect(monthWindow('2028-01-15', 1)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
});

it('the sheet offers the seasons with tours (for the destination, when there is one), soonest first, and the chosen one always', () => {
  const xmas = seasonWindow('christmas', 2026)!;
  const lny = seasonWindow('lunar-new-year', 2027)!;
  const easter = seasonWindow('easter', 2027)!;
  const seasons: SeasonCount[] = [
    { window: easter, count: { tours: 0, operators: 0 } },
    { window: lny, count: { tours: 5, operators: 1, destinations: [{ countryId: 'china', regionId: null, tours: 5, operators: 1 }] } },
    { window: xmas, count: { tours: 9, operators: 2, destinations: [{ countryId: 'japan', regionId: null, tours: 9, operators: 2 }] } },
  ];
  const ids = (s: SearchState) => sheetSeasons(s, seasons).map(w => w.season);
  expect(ids({ filters: {}, sort: 'price', page: 1 })).toEqual(['christmas', 'lunar-new-year']);
  expect(ids({ filters: { destination: japan }, sort: 'price', page: 1 })).toEqual(['christmas']);
  expect(ids({ filters: { dateFrom: easter.from, dateTo: easter.to }, sort: 'price', page: 1 })).toEqual(['christmas', 'lunar-new-year', 'easter']);
});

it('the one-tap lengths are the wide popover\'s, so every width offers the same ranges', () => {
  expect(DAY_PRESETS).toEqual([{ min: 1, max: 3 }, { min: 4, max: 6 }, { min: 7, max: 9 }, { min: 10 }]);
});
