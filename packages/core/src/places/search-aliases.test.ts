import { it, expect } from 'vitest';
import searchAliases from './search-aliases.en.json';
import { places } from './index';
import { suggestRegions } from '../suggest';
import { extractStops } from '../stops';

const aliases = searchAliases as Record<string, string[]>;
const first = (q: string) => suggestRegions(q, places)[0]?.destination;

it('names only places that exist', () => {
  for (const id of Object.keys(aliases)) {
    expect(places.country(id) ?? places.region(id) ?? places.city(id), id).toBeDefined();
  }
});

it.each([
  ['korea', 'korea'], ['Korea', 'korea'], ['usa', 'usa'], ['america', 'usa'], ['uk', 'uk'], ['england', 'uk'],
  ['scotland', 'uk'], ['holland', 'netherlands'], ['uae', 'uae'], ['emirates', 'uae'], ['czechia', 'czech'],
  ['herzegovina', 'bosnia'], ['macedonia', 'north-macedonia'], ['zealand', 'new-zealand'], ['nz', 'new-zealand'],
  ['arabia', 'saudi-arabia'], ['turkiye', 'turkey'],
])('the English country search: %s finds %s', (query, countryId) => {
  expect(first(query)).toEqual({ countryId, regionId: null });
});

it('an English name matches from the start of any word, for cities and regions too', () => {
  expect(first('gyeonggi')).toEqual({ countryId: 'korea', regionId: 'korea-seoul' }); // Seoul & Gyeonggi
  expect(first('york')?.countryId).toBe('uk'); // the city York, exact, before New York by prefix
  expect(suggestRegions('york', places).map(s => s.destination.regionId)).toContain('usa-east'); // New York
});

it('Chinese queries match as before (the suggest tests are unchanged): only English names are split into words', () => {
  expect(first('韓國')).toEqual({ countryId: 'korea', regionId: null });
  expect(first('京畿')).toEqual({ countryId: 'korea', regionId: 'korea-seoul' });
  // 西蘭 is the end of 紐西蘭 / 新西蘭, not the start of a word: no New Zealand row.
  expect(suggestRegions('西蘭', places).map(s => s.destination.countryId)).not.toContain('new-zealand');
});

it('the scraper\'s place index never sees the search aliases', () => {
  for (const [id, names] of Object.entries(aliases)) {
    for (const name of names) {
      expect(places.findCountry(name), `${id} ${name}`).toEqual([]);
      expect(places.findRegion(name), `${id} ${name}`).toEqual([]);
      expect(places.findCity(name), `${id} ${name}`).toEqual([]);
      const place = places.country(id) ?? places.region(id) ?? places.city(id);
      expect(place?.aliases, `${id} ${name}`).not.toContain(name);
    }
  }
  // Operator text naming the UK or the USA in English finds no stop through them.
  expect(extractStops(['UK', 'USA', 'England', 'Holland'], places).stops).toEqual([]);
  // Nor the group words that have no area region (task 40).
  expect(extractStops(['華北', '西北', '大西北', '川渝'], places).stops).toEqual([]);
});
