import { it, expect } from 'vitest';
import { places, type PriceChange, type Stop, type TourPoint } from '@hktours/core';
import { departureDateText, priceChangeText, regionLabel, routeNames, startNote } from './card-text';
import { translate, type T } from './i18n';

const tZh: T = (key, vars) => translate('zh-Hant', key, vars);
const tEn: T = (key, vars) => translate('en', key, vars);

const city = (regionId: string, cityId: string | null): Stop => ({ countryId: regionId.split('-')[0], regionId, cityId });
const kansaiStops: Stop[] = [
  city('japan-kansai', 'japan-kansai-osaka'), city('japan-kansai', 'japan-kansai-kyoto'),
  city('japan-kansai', 'japan-kansai-nara'), city('japan-kansai', 'japan-kansai-kobe'),
];
const tokyoStop = city('japan-kanto', 'japan-kanto-tokyo');
const seoulStop = city('korea-seoul', 'korea-seoul-seoul');

it('routeNames uses the city name, or the region name for a region-only stop', () => {
  expect(routeNames(kansaiStops, places)).toEqual(['大阪', '京都', '奈良', '神戶']);
  expect(routeNames([city('japan-hokkaido', null), city('japan-hokkaido', 'japan-hokkaido-sapporo')], places))
    .toEqual(['北海道', '札幌']);
});

it('routeNames falls back to the region name, then the id, for ids missing from the places list', () => {
  expect(routeNames([city('japan-kansai', 'japan-kansai-nowhere'), city('japan-nowhere', null)], places))
    .toEqual(['關西', 'japan-nowhere']);
});

it('regionLabel', () => {
  expect(regionLabel(kansaiStops, places)).toBe('日本 · 關西');
  expect(regionLabel([...kansaiStops, tokyoStop, seoulStop], places)).toBe('日本 · 關西 +2');
  expect(regionLabel([...kansaiStops, tokyoStop], places, tZh)).toBe('日本 · 關西 +1');
  expect(regionLabel([], places)).toBe('');
});

it.each([
  [{ kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' }, '↓ HK$500　比7日前', 'down'],
  [{ kind: 'higher', diffHkd: 300, sinceDate: '2026-11-05' }, '↑ HK$300　比7日前', 'up'],
  [{ kind: 'same', sinceDate: '2026-11-05' }, '— 與7日前相同', 'same'],
  [{ kind: 'lower', diffHkd: 200, sinceDate: '2026-11-09' }, '↓ HK$200　比3日前', 'down'],
])('priceChangeText(%j)', (change, text, tone) => {
  expect(priceChangeText(change as PriceChange, '2026-11-12', tZh)).toEqual({ text, tone });
});

it('priceChangeText(null) is null', () => { expect(priceChangeText(null, '2026-11-12', tZh)).toBeNull(); });

it.each([
  [{ kind: 'lower', diffHkd: 500, sinceDate: '2026-13-45' }, '2026-11-12'],   // not a real date
  [{ kind: 'same', sinceDate: 'yesterday' }, '2026-11-12'],
  [{ kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' }, 'garbage'],      // bad today
  [{ kind: 'same', sinceDate: '2026-11-12' }, '2026-11-12'],                  // zero days ago
  [{ kind: 'same', sinceDate: '2026-11-20' }, '2026-11-12'],                  // in the future
  [{ kind: 'lower', diffHkd: Number.NaN, sinceDate: '2026-11-05' }, '2026-11-12'],
  [{ kind: 'sideways', sinceDate: '2026-11-05' }, '2026-11-12'],
])('priceChangeText(%j, %s) is null instead of throwing', (change, today) => {
  expect(priceChangeText(change as unknown as PriceChange, today, tZh)).toBeNull();
});

it.each([
  [{ kind: 'hk', label: null }, { kind: 'hk', label: null }, null],
  [{ kind: 'sz', label: null }, { kind: 'sz', label: null }, null],
  [{ kind: 'hk', label: null }, { kind: 'sz', label: null }, null],
  [{ kind: 'other', label: '澳門外港碼頭' }, { kind: 'hk', label: null }, '澳門外港碼頭出發'],
  [{ kind: 'hk', label: null }, { kind: 'other', label: '澳門' }, '澳門解散'],
  [{ kind: 'other', label: '澳門' }, { kind: 'other', label: '珠海' }, '澳門出發 · 珠海解散'],
  [{ kind: 'other', label: '澳門' }, { kind: 'other', label: '澳門' }, '澳門出發'],
  [{ kind: 'other', label: null }, { kind: 'hk', label: null }, null], // 'other' without a label says nothing
])('startNote(%j, %j)', (start, end, expected) => {
  expect(startNote(start as TourPoint, end as TourPoint, tZh)).toBe(expected);
});

it('departureDateText gives the date with its weekday, computed in UTC', () => {
  expect(departureDateText('2026-12-18', tZh)).toBe('2026年12月18日（五）');
  expect(departureDateText('2026-12-20', tZh)).toBe('2026年12月20日（日）');
  expect(departureDateText('2027-01-02', tZh)).toBe('2027年1月2日（六）');
  expect(departureDateText('2026-12-18', tEn)).toBe('Fri 18 Dec 2026');
});

it('departureDateText is null for a string that is not a real date', () => {
  expect(departureDateText('2026-02-30', tZh)).toBeNull();
  expect(departureDateText('soon', tZh)).toBeNull();
});
