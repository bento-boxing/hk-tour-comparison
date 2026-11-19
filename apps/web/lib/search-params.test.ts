import { it, expect } from 'vitest';
import { places } from '@hktours/core';
import { parseSearchParams, buildSearchQuery, withFilters, searchHref, movedSearchHref, DEFAULT_SORT, SORT_KEYS } from './search-params';

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

it('a province that was part of 華中 is a destination; an old 華中 address (china-central) is dropped, not an error', () => {
  expect(parseSearchParams({ dest: 'china-hubei' }, places).filters.destination).toEqual({ countryId: 'china', regionId: 'china-hubei' });
  expect(parseSearchParams({ dest: 'china-central', sort: 'days' }, places)).toEqual({ filters: {}, sort: 'days', page: 1 });
});

it('the provinces and areas of task 40 are destinations, the kept ids still work, and the two retired ids are dropped', () => {
  for (const id of ['china-beijing', 'china-shanghai', 'china-sichuan', 'china-zhejiang', 'china-chongqing', 'china-jilin', 'china-shaanxi', 'china-area-east', 'china-area-northeast']) {
    expect(parseSearchParams({ dest: id }, places).filters.destination, id).toEqual({ countryId: 'china', regionId: id });
  }
  for (const id of ['china-northeast', 'china-northwest']) {
    expect(parseSearchParams({ dest: id, sort: 'days' }, places), id).toEqual({ filters: {}, sort: 'days', page: 1 });
  }
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

it('searchHref is the bare path for the default state, else the search page with the query', () => {
  expect(searchHref({ filters: {}, sort: 'price', page: 1 })).toBe('/');
  expect(searchHref({ filters: { daysMin: 4 }, sort: 'price', page: 2 })).toBe('/?dmin=4&page=2');
});

it('searchHref puts the destination in the path, never in the query, and keeps everything else', () => {
  const japan = { countryId: 'japan', regionId: null };
  const kansai = { countryId: 'japan', regionId: 'japan-kansai' };
  expect(searchHref({ filters: { destination: japan }, sort: 'price', page: 1 })).toBe('/tours/japan');
  expect(searchHref({ filters: { destination: kansai }, sort: 'price', page: 1 })).toBe('/tours/japan-kansai');
  expect(searchHref({ filters: { destination: japan, daysMin: 5, operators: ['egl'] }, sort: 'days', page: 3 }))
    .toBe('/tours/japan?dmin=5&op=egl&sort=days&page=3');
  // Changing and clearing the destination, as the pickers and the pill do: the other filters stay, back on page 1.
  const state = parseSearchParams({ dest: 'japan', dmin: '5', pmax: '9000', sort: 'days', page: '4' }, places);
  expect(searchHref(withFilters(state, { destination: { countryId: 'korea', regionId: 'korea-seoul' } })))
    .toBe('/tours/korea-seoul?dmin=5&pmax=9000&sort=days');
  expect(searchHref(withFilters(state, { destination: undefined }))).toBe('/?dmin=5&pmax=9000&sort=days');
  // The state still reads and writes `dest` itself (the filter bar's typed values and the chain page round-trip it).
  expect(buildSearchQuery(state).get('dest')).toBe('japan');
});

it('buildSearchQuery leaves out empty lists', () => {
  expect(buildSearchQuery({ filters: { operators: [], excludeCountryIds: [] }, sort: 'price', page: 1 }).toString()).toBe('');
});

it('reads the travel window from tfrom and tto, and writes it back', () => {
  const s = parseSearchParams({ tfrom: '2027-01-12', tto: '2027-01-15', from: '2027-01-01' }, places);
  expect(s.filters).toEqual({ dateFrom: '2027-01-01', travelFrom: '2027-01-12', travelTo: '2027-01-15' });
  expect(Object.fromEntries(buildSearchQuery(s))).toEqual({ from: '2027-01-01', tfrom: '2027-01-12', tto: '2027-01-15' });
  expect(parseSearchParams(Object.fromEntries(buildSearchQuery(s)), places)).toEqual(s);
});

it('keeps one valid end of the travel window and drops a bad one', () => {
  expect(parseSearchParams({ tfrom: '2027-01-12', tto: '2027-02-30' }, places).filters).toEqual({ travelFrom: '2027-01-12' });
  expect(parseSearchParams({ tfrom: 'soon', tto: '2027-01-15' }, places).filters).toEqual({ travelTo: '2027-01-15' });
});

it('drops a travel window that ends before it starts, as it drops such a departure window', () => {
  expect(parseSearchParams({ tfrom: '2027-01-15', tto: '2027-01-12' }, places).filters).toEqual({});
  expect(parseSearchParams({ tfrom: '2027-01-15', tto: '2027-01-12', from: '2027-01-01' }, places).filters)
    .toEqual({ dateFrom: '2027-01-01' });
  // One day is a window, not a reversed one.
  expect(parseSearchParams({ tfrom: '2027-01-12', tto: '2027-01-12' }, places).filters)
    .toEqual({ travelFrom: '2027-01-12', travelTo: '2027-01-12' });
});

it.each(['from', 'to', 'tfrom', 'tto'])('drops a %s date before year 1, which the database would refuse', name => {
  for (const text of ['0000-01-01', '0000-12-31']) {
    expect(parseSearchParams({ [name]: text }, places).filters, text).toEqual({});
  }
  // The first and last days the address accepts.
  expect(Object.values(parseSearchParams({ [name]: '0001-01-01' }, places).filters)).toEqual(['0001-01-01']);
  expect(Object.values(parseSearchParams({ [name]: '9999-12-31' }, places).filters)).toEqual(['9999-12-31']);
});

it.each(['10000-01-01', '2027-02-30', '2027-13-01', '+02027-01-01', '2027-01-01T00:00'])('drops the date %s', text => {
  expect(parseSearchParams({ from: text, to: text, tfrom: text, tto: text }, places).filters).toEqual({});
});

it('includeDates false drops the travel window too', () => {
  expect(parseSearchParams({ tfrom: '2027-01-12', tto: '2027-01-15', dmin: '4' }, places, { includeDates: false }).filters)
    .toEqual({ daysMin: 4 });
});

it.each([
  ['price'], ['price-desc'], ['days'], ['days-desc'], ['date'], ['date-desc'], ['destination'], ['destination-desc'],
] as const)('sort=%s is read and written back as itself', sort => {
  const s = parseSearchParams({ sort }, places);
  expect(s.sort).toBe(sort);
  expect(parseSearchParams(Object.fromEntries(buildSearchQuery(s)), places).sort).toBe(sort);
});

it('offers eight sort orders, each bare name keeping its old meaning', () => {
  expect(SORT_KEYS).toEqual(['price', 'price-desc', 'days', 'days-desc', 'date', 'date-desc', 'destination', 'destination-desc']);
  expect(parseSearchParams({ sort: 'days' }, places).sort).toBe('days');
  expect(parseSearchParams({ sort: 'DAYS-DESC' }, places).sort).toBe('price');
  expect(parseSearchParams({ sort: '-price' }, places).sort).toBe('price');
});

it('an old address with dest= moves to the destination\'s page, keeping the other filters', () => {
  expect(movedSearchHref({ dest: 'japan', dmin: '5' }, places)).toBe('/tours/japan?dmin=5');
  expect(movedSearchHref({ dest: 'china-beijing', sort: 'days', page: '2', op: 'egl' }, places)).toBe('/tours/china-beijing?op=egl&sort=days&page=2');
  expect(movedSearchHref({ dest: 'china-area-east' }, places)).toBe('/tours/china-area-east');
  // The only region of its country goes to the country's page (the region's own page is a noindex copy of it).
  expect(movedSearchHref({ dest: 'france-france', dmin: '5' }, places)).toBe('/tours/france?dmin=5');
  expect(movedSearchHref({ dest: 'singapore-singapore' }, places)).toBe('/tours/singapore');
  // Invalid values are dropped as the page drops them; the search page has no exclusions.
  expect(movedSearchHref({ dest: 'japan', dmin: 'x', ex: 'korea', utm_source: 'mail' }, places)).toBe('/tours/japan');
  // A repeated dest uses its first value, as the page always has.
  expect(movedSearchHref({ dest: ['korea', 'japan'] }, places)).toBe('/tours/korea');
});

it('an old address whose dest names no destination stays where it is (its dest ignored, as before)', () => {
  for (const dest of ['nonsense', 'Japan', 'china-central', 'japan-kansai-osaka', '', '//evil.example', '../en']) {
    expect(movedSearchHref({ dest, dmin: '5' }, places), dest).toBeNull();
  }
  expect(movedSearchHref({ dmin: '5' }, places)).toBeNull();
  expect(movedSearchHref({}, places)).toBeNull();
});

