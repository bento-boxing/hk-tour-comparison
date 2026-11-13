import { it, expect } from 'vitest';
import { decodeChain, places, DEFAULT_GAP, MAX_CHAIN_LEGS } from '@hktours/core';
import { parseSearchParams } from './search-params';
import {
  chainHref, chainPageHref, chainStartHref, withGap, withLegAdded, withoutLastLeg, withPage, withSearch, type ChainAddress,
} from './chain-href';

it('chainStartHref starts a chain with one leg and the default gap', () => {
  expect(chainStartHref('egl:KIX5', '2026-12-18')).toBe('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3');
});

it('chainHref writes any chain, and decodeChain reads it back', () => {
  const chain = {
    legs: [{ tourKey: 'egl:KIX5', departure: '2026-12-18' }, { tourKey: 'jetour:TYO-KIX', departure: '2026-12-24' }],
    gap: { min: 2, max: 5 },
  };
  const url = new URL(chainHref(chain), 'http://localhost');
  expect(url.pathname).toBe('/chain');
  expect(decodeChain({ legs: url.searchParams.get('legs'), gap: url.searchParams.get('gap') })).toEqual(chain);
});

it('a chain with no legs keeps only the gap', () => {
  expect(chainHref({ legs: [], gap: { ...DEFAULT_GAP } })).toBe('/chain?gap=1-3');
});

// The chain page's own address: the chain, then the visitor's filters (never from/to), sort and page.
const address: ChainAddress = {
  chain: { legs: [{ tourKey: 'egl:KIX5', departure: '2026-12-18' }], gap: { min: 1, max: 3 } },
  search: { filters: { destination: { countryId: 'korea', regionId: null }, excludeCountryIds: ['japan'], daysMax: 6, operators: ['jetour'] }, sort: 'days', page: 3 },
};
const KEEP = 'dest=korea&ex=japan&dmax=6&op=jetour&sort=days';

it('chainPageHref writes the chain first, then the filters, sort and page', () => {
  expect(chainPageHref(address)).toBe(`/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&${KEEP}&page=3`);
  expect(chainPageHref({ chain: { legs: [], gap: { min: 1, max: 3 } }, search: { filters: {}, sort: 'price', page: 1 } })).toBe('/chain?gap=1-3');
});

it('chainPageHref never writes a departure window: the page sets it from the gap', () => {
  const withDates = { ...address, search: { ...address.search, filters: { ...address.search.filters, dateFrom: '2026-12-01', dateTo: '2026-12-31' } } };
  expect(chainPageHref(withDates)).toBe(chainPageHref(address));
});

it('chainPageHref reads back through decodeChain and parseSearchParams to the same state', () => {
  const url = new URL(chainPageHref(address), 'http://localhost');
  const raw = Object.fromEntries(url.searchParams);
  expect(decodeChain({ legs: raw.legs, gap: raw.gap })).toEqual(address.chain);
  expect(parseSearchParams(raw, places, { includeDates: false })).toEqual(address.search);
});

it('adding a leg appends it, keeps the gap and filters, and goes back to page 1', () => {
  const next = withLegAdded(address, { tourKey: 'texpert:SEL5', departure: '2026-12-24' });
  expect(next.chain).toEqual({
    legs: [{ tourKey: 'egl:KIX5', departure: '2026-12-18' }, { tourKey: 'texpert:SEL5', departure: '2026-12-24' }],
    gap: { min: 1, max: 3 },
  });
  expect(chainPageHref(next)).toBe(`/chain?legs=egl%3AKIX5%402026-12-18%2Ctexpert%3ASEL5%402026-12-24&gap=1-3&${KEEP}`);
  expect(address.chain.legs).toHaveLength(1); // the original is not changed
});

it('adding a leg to a full chain changes nothing but the page', () => {
  const legs = Array.from({ length: MAX_CHAIN_LEGS }, (_, i) => ({ tourKey: 'egl:KIX5', departure: `2027-01-${String(10 + i).padStart(2, '0')}` }));
  const full = { ...address, chain: { ...address.chain, legs } };
  expect(withLegAdded(full, { tourKey: 'texpert:SEL5', departure: '2027-02-01' }).chain.legs).toEqual(legs);
});

it('removing the last leg keeps the others, the gap and the filters, and goes back to page 1', () => {
  const two = withLegAdded(address, { tourKey: 'texpert:SEL5', departure: '2026-12-24' });
  expect(chainPageHref(withoutLastLeg({ ...two, search: { ...two.search, page: 2 } })))
    .toBe(`/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&${KEEP}`);
  expect(chainPageHref(withoutLastLeg(address))).toBe(`/chain?gap=1-3&${KEEP}`);
  expect(withoutLastLeg(withoutLastLeg(address)).chain.legs).toEqual([]);
});

it('changing the gap keeps the legs and filters, cleans the gap, and goes back to page 1', () => {
  expect(chainPageHref(withGap(address, { min: 2, max: 5 }))).toBe(`/chain?legs=egl%3AKIX5%402026-12-18&gap=2-5&${KEEP}`);
  expect(withGap(address, { min: 9, max: 2 }).chain.gap).toEqual({ min: 2, max: 9 });
  expect(withGap(address, { min: -1, max: 99 }).chain.gap).toEqual({ min: 0, max: 30 });
});

it('changing a filter or the sort keeps the legs and gap and goes back to page 1', () => {
  const next = withSearch(address, { filters: { excludeCountryIds: ['japan', 'korea'] }, sort: 'price', page: 4 });
  expect(chainPageHref(next)).toBe('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&ex=japan%2Ckorea');
});

it('paging keeps everything else', () => {
  expect(chainPageHref(withPage(address, 4))).toBe(`/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&${KEEP}&page=4`);
  expect(chainPageHref(withPage(address, 1))).toBe(`/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&${KEEP}`);
});
