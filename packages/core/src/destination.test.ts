import { it, expect } from 'vitest';
import { tourMatchesDestination, tourVisitsCountry, tourRegions } from './index';
import type { Destination, Stop } from './index';

const osaka: Stop = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' };
const tokyo: Stop = { countryId: 'japan', regionId: 'japan-kanto', cityId: 'japan-kanto-tokyo' };
const seoul: Stop = { countryId: 'korea', regionId: 'korea-seoul', cityId: 'korea-seoul-seoul' };
const hokkaidoRegionOnly: Stop = { countryId: 'japan', regionId: 'japan-hokkaido', cityId: null };
const kansai: Destination = { countryId: 'japan', regionId: 'japan-kansai' };

it('matches when the region is the first stop', () => { expect(tourMatchesDestination([osaka, tokyo], kansai)).toBe(true); });
it('matches when the region is an intermediate stop', () => { expect(tourMatchesDestination([tokyo, osaka, tokyo], kansai)).toBe(true); });
it('matches when the region is the last stop', () => { expect(tourMatchesDestination([tokyo, osaka], kansai)).toBe(true); });
it('does not match another region', () => { expect(tourMatchesDestination([tokyo], kansai)).toBe(false); });
it('country-wide destination matches any region of it', () => {
  expect(tourMatchesDestination([tokyo], { countryId: 'japan', regionId: null })).toBe(true);
  expect(tourMatchesDestination([seoul], { countryId: 'japan', regionId: null })).toBe(false);
});
it('matches a region-only stop', () => {
  expect(tourMatchesDestination([hokkaidoRegionOnly], { countryId: 'japan', regionId: 'japan-hokkaido' })).toBe(true);
});
it('empty stops never match', () => { expect(tourMatchesDestination([], kansai)).toBe(false); });
it('tourVisitsCountry', () => {
  expect(tourVisitsCountry([tokyo, seoul], 'korea')).toBe(true);
  expect(tourVisitsCountry([tokyo, osaka], 'korea')).toBe(false);
  expect(tourVisitsCountry([], 'japan')).toBe(false);
});
it('tourRegions is distinct and in route order', () => {
  expect(tourRegions([osaka, tokyo, osaka, seoul])).toEqual([
    { countryId: 'japan', regionId: 'japan-kansai' }, { countryId: 'japan', regionId: 'japan-kanto' },
    { countryId: 'korea', regionId: 'korea-seoul' },
  ]);
  expect(tourRegions([])).toEqual([]);
});
