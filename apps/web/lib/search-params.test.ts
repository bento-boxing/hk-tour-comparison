import { it, expect } from 'vitest';
import { places } from '@hktours/core';
import { parseSearchParams, buildSearchQuery, withFilters, searchHref, DEFAULT_SORT } from './search-params';

it('parses a full address', () => {
  const s = parseSearchParams({ dest: 'japan-kansai', from: '2026-12-01', to: '2026-12-31', dmin: '4', dmax: '6',
    pmin: '5000', pmax: '12000', op: 'egl,jetour', sort: 'days', page: '2' }, places);
  expect(s).toEqual({
    filters: { destination: { countryId: 'japan', regionId: 'japan-kansai' }, dateFrom: '2026-12-01', dateTo: '2026-12-31',
      daysMin: 4, daysMax: 6, priceMin: 5000, priceMax: 12000, operators: ['egl', 'jetour'] },
    sort: 'days', page: 2,
  });
});

it('a country id means all regions', () => {
  expect(parseSearchParams({ dest: 'japan' }, places).filters.destination).toEqual({ countryId: 'japan', regionId: null });
});

it('empty address gives defaults', () => {
  expect(parseSearchParams({}, places)).toEqual({ filters: {}, sort: 'price', page: 1 });
  expect(DEFAULT_SORT).toBe('price');
});

it.each([
  [{ dest: 'atlantis' }], [{ from: '2026-02-30' }], [{ from: '2026-12-31', to: '2026-12-01' }],
  [{ dmin: '0' }], [{ dmin: '4.5' }], [{ dmax: '61' }], [{ pmin: '-5' }], [{ pmin: 'abc' }],
  [{ op: 'wingon' }], [{ sort: 'random' }], [{ page: '0' }], [{ page: '-3' }], [{ page: 'x' }],
  [{ dest: '<script>' }], [{ ex: 'atlantis' }],
])('ignores invalid input %j', raw => {
  expect(parseSearchParams(raw, places)).toEqual({ filters: {}, sort: 'price', page: 1 });
});

it.each([
  [{ dmin: '1e1' }], [{ dmin: ' 4' }], [{ pmax: '2000001' }], [{ pmin: '0x10' }], [{ page: '1.5' }],
  [{ page: '99999999999999999999' }], [{ dest: '__proto__' }], [{ dest: 'constructor' }], [{ sort: 'toString' }],
  [{ op: '' }], [{ op: ',,,' }], [{ from: '2026-12-1' }], [{ to: 'tomorrow' }], [{ dest: '' }],
])('also ignores %j', raw => {
  expect(parseSearchParams(raw, places)).toEqual({ filters: {}, sort: 'price', page: 1 });
});

it('never throws on values of the wrong shape', () => {
  const odd = { dest: [] as string[], op: [undefined as unknown as string], page: 5 as unknown as string, sort: {} as unknown as string };
  expect(parseSearchParams(odd, places)).toEqual({ filters: {}, sort: 'price', page: 1 });
});

it('accepts the range ends', () => {
  expect(parseSearchParams({ dmin: '1', dmax: '60', pmin: '0', pmax: '2000000' }, places).filters)
    .toEqual({ daysMin: 1, daysMax: 60, priceMin: 0, priceMax: 2000000 });
});

it('keeps one valid end of a date window', () => {
  expect(parseSearchParams({ from: '2026-12-01', to: 'garbage' }, places).filters).toEqual({ dateFrom: '2026-12-01' });
  expect(parseSearchParams({ to: '2026-12-31' }, places).filters).toEqual({ dateTo: '2026-12-31' });
});

it('swaps reversed ranges', () => {
  expect(parseSearchParams({ dmin: '6', dmax: '4', pmin: '9000', pmax: '5000' }, places).filters)
    .toEqual({ daysMin: 4, daysMax: 6, priceMin: 5000, priceMax: 9000 });
});

it('keeps valid operators and exclusions, drops unknown ones', () => {
  const f = parseSearchParams({ op: 'egl,wingon,jetour', ex: 'japan,atlantis' }, places).filters;
  expect(f.operators).toEqual(['egl', 'jetour']); expect(f.excludeCountryIds).toEqual(['japan']);
});

it('lists each operator and exclusion once', () => {
  const f = parseSearchParams({ op: 'jetour,egl,jetour', ex: 'korea,japan,korea' }, places).filters;
  expect(f.operators).toEqual(['egl', 'jetour']);
  expect(f.excludeCountryIds).toEqual(['korea', 'japan']);
});

it('uses the first value of a repeated parameter', () => {
  expect(parseSearchParams({ sort: ['days', 'date'] }, places).sort).toBe('days');
});

it('includeDates false drops the date window', () => {
  expect(parseSearchParams({ from: '2026-12-01', dmin: '4' }, places, { includeDates: false }).filters).toEqual({ daysMin: 4 });
});

it('buildSearchQuery omits defaults and round-trips', () => {
  expect(buildSearchQuery({ filters: {}, sort: 'price', page: 1 }).toString()).toBe('');
  const s = parseSearchParams({ dest: 'japan', op: 'egl', sort: 'date', page: '3', ex: 'korea' }, places);
  expect(parseSearchParams(Object.fromEntries(buildSearchQuery(s)), places)).toEqual(s);
});

it('buildSearchQuery writes every filter and round-trips a full address', () => {
  const s = parseSearchParams({ dest: 'japan-kansai', from: '2026-12-01', to: '2026-12-31', dmin: '4', dmax: '6',
    pmin: '0', pmax: '12000', op: 'egl,jetour', ex: 'korea', sort: 'destination', page: '2' }, places);
  const query = buildSearchQuery(s);
  expect(Object.fromEntries(query)).toEqual({
    dest: 'japan-kansai', ex: 'korea', from: '2026-12-01', to: '2026-12-31', dmin: '4', dmax: '6',
    pmin: '0', pmax: '12000', op: 'egl,jetour', sort: 'destination', page: '2',
  });
  expect(parseSearchParams(Object.fromEntries(query), places)).toEqual(s);
});

it('withFilters applies a change, removes cleared filters and goes back to page 1', () => {
  const s = { filters: { daysMin: 4, daysMax: 6, operators: ['egl' as const] }, sort: 'days' as const, page: 3 };
  expect(withFilters(s, { daysMax: undefined, operators: [], priceMin: 5000 }))
    .toStrictEqual({ filters: { daysMin: 4, priceMin: 5000 }, sort: 'days', page: 1 });
  expect(s.filters).toEqual({ daysMin: 4, daysMax: 6, operators: ['egl'] }); // not changed in place
});

it('searchHref is the bare path for the default state', () => {
  expect(searchHref({ filters: {}, sort: 'price', page: 1 })).toBe('/');
  expect(searchHref({ filters: { daysMin: 4 }, sort: 'price', page: 2 }, '/chain')).toBe('/chain?dmin=4&page=2');
});

it('buildSearchQuery leaves out empty lists', () => {
  expect(buildSearchQuery({ filters: { operators: [], excludeCountryIds: [] }, sort: 'price', page: 1 }).toString()).toBe('');
});
