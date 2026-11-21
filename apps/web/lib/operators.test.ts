import { it, expect } from 'vitest';
import { OPERATOR_IDS, places } from '@hktours/core';
import { parseSearchParams } from './search-params';
import {
  OPERATORS_PATH, isOperatorListed, isOperatorShown, joinNames, officialSiteUrl, operatorFromId, operatorPath, operatorPlaces, operatorSearchHref,
  shownOperators, stateHrefFor,
} from './operators';

it('an operator\'s page is /operators/<id>, for every operator the site knows and nothing else', () => {
  expect(OPERATORS_PATH).toBe('/operators');
  for (const id of OPERATOR_IDS) {
    expect(operatorFromId(id)).toBe(id);
    expect(operatorPath(id)).toBe(`/operators/${id}`);
  }
  for (const id of ['', 'EGL', 'egl ', 'eg', 'japan', 'constructor', '__proto__', 'toString', 'egl/x']) expect(operatorFromId(id), id).toBeUndefined();
});

it('a search state\'s address on an operator\'s page keeps the page\'s path, every other setting in the query, and never an op', () => {
  const state = (query: Record<string, string>) => parseSearchParams(query, places);
  expect(operatorSearchHref('texpert', state({}))).toBe('/operators/texpert');
  expect(operatorSearchHref('texpert', state({ op: 'texpert' }))).toBe('/operators/texpert');
  // Another operator in the state (a hand-made address) changes nothing: the path's operator is the page's.
  expect(operatorSearchHref('texpert', state({ op: 'egl,jetour', dmin: '5' }))).toBe('/operators/texpert?dmin=5');
  // The destination is a filter here, so it stays in the query (on '/' it would be the path: /tours/japan).
  expect(operatorSearchHref('egl', state({ dest: 'japan-kansai', dmin: '4', dmax: '6', sort: 'days', size: '48', page: '3' })))
    .toBe('/operators/egl?dest=japan-kansai&dmin=4&dmax=6&sort=days&size=48&page=3');
});

it('stateHrefFor: an operator\'s page builds its own addresses; every other search page the search page\'s', () => {
  const state = parseSearchParams({ dest: 'japan', dmin: '5' }, places);
  expect(stateHrefFor(null)(state)).toBe('/tours/japan?dmin=5');
  expect(stateHrefFor('egl')(state)).toBe('/operators/egl?dest=japan&dmin=5');
});

it('an operator exists for the site only once it has had a good run; it has a page for search engines only while it lists tours', () => {
  const ran = '2026-11-12T18:00:00.000Z';
  expect(isOperatorShown({ lastGoodRunAt: ran })).toBe(true);
  expect(isOperatorShown({ lastGoodRunAt: null })).toBe(false);
  expect(shownOperators([{ id: 'a', lastGoodRunAt: ran }, { id: 'b', lastGoodRunAt: null }, { id: 'c', lastGoodRunAt: ran }]).map(o => o.id)).toEqual(['a', 'c']);
  expect(isOperatorListed({ tours: 1, lastGoodRunAt: ran })).toBe(true);
  expect(isOperatorListed({ tours: 0, lastGoodRunAt: ran })).toBe(false);
  expect(isOperatorListed({ tours: 1, lastGoodRunAt: null })).toBe(false);
});

it('operatorPlaces: the countries with most tours first, by name in the page\'s language, at most three, unknown ids skipped', () => {
  const listing = { countries: [
    { countryId: 'japan', tours: 9 }, { countryId: 'atlantis', tours: 5 }, { countryId: 'korea', tours: 4 },
    { countryId: 'taiwan', tours: 2 }, { countryId: 'china', tours: 1 },
  ] };
  expect(operatorPlaces(listing, places, 'zh-Hant')).toEqual(['日本', '韓國', '台灣']);
  expect(operatorPlaces(listing, places, 'zh-Hans')).toEqual(['日本', '韩国', '台湾']);
  expect(operatorPlaces(listing, places, 'en')).toEqual(['Japan', 'South Korea', 'Taiwan']);
  expect(operatorPlaces(listing, places, 'en', 1)).toEqual(['Japan']);
  expect(operatorPlaces({ countries: [] }, places, 'en')).toEqual([]);
});

it('joinNames writes a list as each language does', () => {
  expect(joinNames(['日本', '韓國', '台灣'], 'zh-Hant')).toBe('日本、韓國及台灣');
  expect(joinNames(['日本', '韩国'], 'zh-Hans')).toBe('日本和韩国');
  expect(joinNames(['Japan', 'South Korea', 'Taiwan'], 'en')).toBe('Japan, South Korea and Taiwan');
  expect(joinNames(['Japan'], 'en')).toBe('Japan');
});

it('officialSiteUrl: only an absolute http(s) address becomes a link', () => {
  expect(officialSiteUrl('https://www.example.test')).toBe('https://www.example.test/');
  expect(officialSiteUrl('http://example.test/home')).toBe('http://example.test/home');
  for (const bad of ['', 'www.example.test', '/operators/egl', 'javascript:alert(1)', 'mailto:a@example.test', 'data:text/html,x']) {
    expect(officialSiteUrl(bad), bad).toBeNull();
  }
});
