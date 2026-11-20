import { it, expect } from 'vitest';
import { places } from '@hktours/core';
import type { DestinationCounts } from '@hktours/db/read';
import { makeT } from './i18n';
import { retiredRegion } from './place-names';
import {
  countOf, destinationFromId, destinationId, destinationIndex, destinationName, destinationPath, isArea, isListed,
  isOnlyRegion, listedDestinations, topDestinations, SHORTCUT_COUNT,
} from './destinations';

const japan = { countryId: 'japan', regionId: null };
const kansai = { countryId: 'japan', regionId: 'japan-kansai' };
const east = { countryId: 'china', regionId: 'china-area-east' };
const france = { countryId: 'france', regionId: null };
const franceOnly = { countryId: 'france', regionId: 'france-france' };

/** Counts as the database read gives them: invented numbers, in id order. */
const counts: DestinationCounts = {
  all: { tours: 30, operators: 4 },
  destinations: [
    { countryId: 'china', regionId: null, tours: 6, operators: 2 },
    { countryId: 'china', regionId: 'china-area-east', tours: 1, operators: 1 },
    { countryId: 'china', regionId: 'china-beijing', tours: 3, operators: 2 },
    { countryId: 'china', regionId: 'china-shanghai', tours: 2, operators: 1 },
    { countryId: 'france', regionId: null, tours: 4, operators: 1 },
    { countryId: 'france', regionId: 'france-france', tours: 4, operators: 1 },
    { countryId: 'japan', regionId: null, tours: 12, operators: 3 },
    { countryId: 'japan', regionId: 'japan-kansai', tours: 7, operators: 3 },
    { countryId: 'japan', regionId: 'japan-kanto', tours: 5, operators: 2 },
    { countryId: 'korea', regionId: null, tours: 8, operators: 2 },
    { countryId: 'korea', regionId: 'korea-seoul', tours: 8, operators: 2 },
  ],
};

it('an id is a country or a region of the places data, spelled exactly; anything else is no destination', () => {
  expect(destinationFromId('japan', places)).toEqual(japan);
  expect(destinationFromId('japan-kansai', places)).toEqual(kansai);
  expect(destinationFromId('china-area-east', places)).toEqual(east);
  for (const id of ['Japan', 'japan-kansai-osaka', 'nowhere', '', '__proto__', 'constructor', 'japan/', ' japan']) {
    expect(destinationFromId(id, places), id).toBeUndefined();
  }
});

it('a retired region (replaced by others) is no destination', () => {
  for (const id of ['china-central', 'china-northeast', 'china-northwest']) {
    expect(retiredRegion(id), id).toBeDefined();
    expect(destinationFromId(id, places), id).toBeUndefined();
  }
});

it('every country and region has an address /tours/<id>, and the id reads back as the same destination', () => {
  const all = [
    ...places.data.countries.map(c => ({ countryId: c.id, regionId: null })),
    ...places.data.regions.map(r => ({ countryId: r.countryId, regionId: r.id })),
  ];
  for (const d of all) {
    expect(destinationPath(d)).toMatch(/^\/tours\/[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(destinationFromId(destinationId(d), places)).toEqual(d);
  }
  expect(new Set(all.map(destinationId)).size).toBe(all.length); // no country shares an id with a region
  expect(destinationPath(null)).toBe('/');
  expect(destinationPath(undefined)).toBe('/');
});

it('an area region and the only region of a country are told apart', () => {
  expect(isArea(east, places)).toBe(true);
  expect(isArea(kansai, places)).toBe(false);
  expect(isArea(japan, places)).toBe(false);
  expect(isOnlyRegion(franceOnly, places)).toBe(true);
  expect(isOnlyRegion(france, places)).toBe(false);
  expect(isOnlyRegion(kansai, places)).toBe(false);
});

it('a destination is listed when it has tours and is neither an area nor the only region of its country', () => {
  expect(isListed(japan, places, counts)).toBe(true);
  expect(isListed(kansai, places, counts)).toBe(true);
  expect(isListed(france, places, counts)).toBe(true);
  expect(isListed({ countryId: 'japan', regionId: 'japan-okinawa' }, places, counts)).toBe(false); // no tours
  expect(isListed({ countryId: 'thailand', regionId: null }, places, counts)).toBe(false); // no tours
  expect(isListed(east, places, counts)).toBe(false); // an area, though it has a tour
  expect(isListed(franceOnly, places, counts)).toBe(false); // France's only region
  expect(countOf({ countryId: 'thailand', regionId: null }, counts)).toEqual({ tours: 0, operators: 0 });
  expect(countOf(kansai, counts)).toEqual({ tours: 7, operators: 3 });
});

it('the index arranges the listed destinations as the country picker does: parts of the world, countries, regions', () => {
  const index = destinationIndex(places, counts);
  expect(index.map(g => [g.id, g.countries.map(c => [c.country.id, c.count.tours, c.regions.map(r => `${r.region.id}:${r.count.tours}`)])])).toEqual([
    ['china', [['china', 6, ['china-beijing:3', 'china-shanghai:2']]]],
    ['northeast-asia', [['japan', 12, ['japan-kanto:5', 'japan-kansai:7']], ['korea', 8, ['korea-seoul:8']]]],
    ['europe', [['france', 4, []]]],
  ]);
  expect(listedDestinations(places, counts).map(destinationId)).toEqual([
    'china', 'china-beijing', 'china-shanghai', 'japan', 'japan-kanto', 'japan-kansai', 'korea', 'korea-seoul', 'france',
  ]);
  expect(destinationIndex(places, { all: { tours: 0, operators: 0 }, destinations: [] })).toEqual([]);
});

it('the band\'s shortcuts: listed countries only, most tours first, equal counts in the index\'s order, at most seven', () => {
  const ids = (n?: number) => topDestinations(places, counts, n).map(({ destination, count }) => `${destinationId(destination)} ${count.tours}`);
  expect(SHORTCUT_COUNT).toBe(7);
  // Countries only: never a country beside its own regions (日本, 日本關西, 日本關東). Kansai (7) has more tours
  // than China (6) but is not a country.
  expect(ids()).toEqual(['japan 12', 'korea 8', 'china 6', 'france 4']);
  expect(ids(2)).toEqual(['japan 12', 'korea 8']);
  for (const { destination } of topDestinations(places, counts)) expect(destination.regionId).toBeNull();
  expect(topDestinations(places, { all: { tours: 0, operators: 0 }, destinations: [] })).toEqual([]);
});

it('names a destination in each language, a region with its country unless its name already says it', () => {
  const name = (d: { countryId: string; regionId: string | null }) =>
    (['zh-Hant', 'zh-Hans', 'en'] as const).map(locale => destinationName(d, places, makeT(locale)));
  expect(name(japan)).toEqual(['日本', '日本', 'Japan']);
  expect(name(kansai)).toEqual(['日本關西', '日本关西', 'Kansai, Japan']);
  expect(name({ countryId: 'china', regionId: 'china-beijing' })).toEqual(['中國北京', '中国北京', 'Beijing, China']);
  expect(name({ countryId: 'taiwan', regionId: 'taiwan-north' })).toEqual(['台灣北部', '台湾北部', 'Northern Taiwan']);
  expect(name(east)).toEqual(['中國華東', '中国华东', 'East China']);
});
