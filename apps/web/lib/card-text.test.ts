import { describe, it, expect } from 'vitest';
import { places, type PriceChange, type Stop, type TourPoint } from '@hktours/core';
import { departureDateText, departurePrice, priceChangeText, regionLabel, routeNames, startNote } from './card-text';
import { makeT } from './i18n';

const tZh = makeT('zh-Hant');
const tEn = makeT('en');

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

it('routeNames falls back to the region name for an unknown city, and leaves out a stop whose region is unknown (never an id)', () => {
  expect(routeNames([city('japan-kansai', 'japan-kansai-nowhere'), city('japan-nowhere', null)], places)).toEqual(['關西']);
  // Nothing nameable left: the country, so the card's route line is never empty while the country is known.
  expect(routeNames([city('japan-nowhere', null)], places)).toEqual(['日本']);
  expect(routeNames([city('japan-nowhere', null)], places, 'en')).toEqual(['Japan']);
  expect(routeNames([{ countryId: 'atlantis', regionId: 'atlantis-nowhere', cityId: null }], places)).toEqual([]);
});

it('regionLabel', () => {
  expect(regionLabel(kansaiStops, places)).toBe('日本 · 關西');
  expect(regionLabel([...kansaiStops, tokyoStop, seoulStop], places)).toBe('日本 · 關西 +2');
  expect(regionLabel([...kansaiStops, tokyoStop], places, tZh)).toBe('日本 · 關西 +1');
  expect(regionLabel([], places)).toBe('');
});

it('regionLabel names the province of a stop that was in 華中 (task 37)', () => {
  const wuhan: Stop = { countryId: 'china', regionId: 'china-hubei', cityId: 'china-central-wuhan' };
  expect(regionLabel([wuhan], places)).toBe('中國 · 湖北');
  expect(regionLabel([wuhan], places, tEn)).toBe('China · Hubei');
  expect(routeNames([wuhan, { countryId: 'china', regionId: 'china-jiangxi', cityId: null }], places)).toEqual(['武漢', '江西']);
});

it('regionLabel reads a stop saved before 華中 was split by its city, or names the country alone (task 37)', () => {
  // Saved stops keep the old region id until the operator's next good run rewrites them.
  const savedWuhan: Stop = { countryId: 'china', regionId: 'china-central', cityId: 'china-central-wuhan' };
  const savedNanchang: Stop = { countryId: 'china', regionId: 'china-central', cityId: 'china-central-nanchang' };
  expect(regionLabel([savedWuhan], places)).toBe('中國 · 湖北');
  expect(regionLabel([savedWuhan, savedNanchang], places)).toBe('中國 · 湖北 +1');
  expect(routeNames([savedWuhan], places)).toEqual(['武漢']);
});

describe('a stop saved under the retired region 華中 (china-central) reads as it did before the split (review I1)', () => {
  const saved華中: Stop = { countryId: 'china', regionId: 'china-central', cityId: null };
  const savedWuhan: Stop = { countryId: 'china', regionId: 'china-central', cityId: 'china-central-wuhan' };
  const hunan: Stop = { countryId: 'china', regionId: 'china-hunan', cityId: null };
  it.each([
    ['zh-Hant', tZh, '華中', '中國 · 華中'],
    ['zh-Hans', makeT('zh-Hans'), '华中', '中国 · 华中'],
    ['en', tEn, 'Central China', 'China · Central China'],
  ] as const)('route and label in %s, never the id', (locale, t, name, label) => {
    expect(routeNames([saved華中], places, locale)).toEqual([name]);
    expect(routeNames([saved華中], places, locale)).not.toContain('china-central');
    expect(regionLabel([saved華中], places, t)).toBe(label);
  });
  it('an old city stop and an old region-only stop: the province, with no +1 for the 華中 it was part of', () => {
    expect(routeNames([savedWuhan, saved華中], places)).toEqual(['武漢', '華中']);
    expect(regionLabel([savedWuhan, saved華中], places)).toBe('中國 · 湖北');
    expect(regionLabel([saved華中, savedWuhan], places, tEn)).toBe('China · Hubei');
  });
  it('beside another region, 華中 counts as one more region', () => {
    expect(routeNames([hunan, saved華中], places, 'en')).toEqual(['Hunan', 'Central China']);
    expect(regionLabel([hunan, saved華中], places)).toBe('中國 · 湖南 +1');
    expect(regionLabel([saved華中, hunan], places, tEn)).toBe('China · Central China +1');
  });
  it('a region unknown and not retired is left out of the label and the +N count', () => {
    expect(regionLabel([city('japan-nowhere', null), tokyoStop], places)).toBe('日本 · 關東');
    expect(regionLabel([tokyoStop, city('japan-nowhere', null)], places)).toBe('日本 · 關東');
    expect(regionLabel([city('japan-nowhere', null)], places)).toBe('日本');
    expect(regionLabel([{ countryId: 'atlantis', regionId: 'atlantis-nowhere', cityId: null }], places)).toBe('');
  });
});

it('regionLabel names a country once when its region has the same name', () => {
  const paris: Stop = { countryId: 'france', regionId: 'france-france', cityId: 'france-france-paris' };
  const zurich: Stop = { countryId: 'switzerland', regionId: 'switzerland-switzerland', cityId: 'switzerland-switzerland-zurich' };
  expect(regionLabel([paris], places)).toBe('法國');
  expect(regionLabel([paris, zurich], places)).toBe('法國 +1');
  // A different region name still shows both, and later same-named regions only count towards +N.
  expect(regionLabel([...kansaiStops, paris], places)).toBe('日本 · 關西 +1');
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
  expect(departureDateText('2026-12-18', makeT('zh-Hans'))).toBe('2026年12月18日（周五）');
});

it('routeNames and regionLabel name the places in the visitor\'s language', () => {
  expect(routeNames(kansaiStops, places, 'en')).toEqual(['Osaka', 'Kyoto', 'Nara', 'Kobe']);
  expect(routeNames([seoulStop, city('japan-hokkaido', null)], places, 'zh-Hans')).toEqual(['首尔', '北海道']);
  expect(regionLabel([...kansaiStops, tokyoStop], places, tEn)).toBe('Japan · Kansai +1');
  expect(regionLabel([seoulStop], places, makeT('zh-Hans'))).toBe('韩国 · 首尔及京畿');
  // A region named like its country is still named once.
  expect(regionLabel([city('france-france', 'france-france-paris')], places, tEn)).toBe('France');
});

it.each([
  [{ kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' }, '↓ HK$500 since 7 days ago'],
  [{ kind: 'higher', diffHkd: 300, sinceDate: '2026-11-11' }, '↑ HK$300 since 1 day ago'],
  [{ kind: 'same', sinceDate: '2026-11-05' }, '— unchanged since 7 days ago'],
])('priceChangeText in English (%j)', (change, text) => {
  expect(priceChangeText(change as PriceChange, '2026-11-12', tEn)?.text).toBe(text);
});

it('priceChangeText in Simplified Chinese', () => {
  const change: PriceChange = { kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' };
  expect(priceChangeText(change, '2026-11-12', makeT('zh-Hans'))?.text).toBe('↓ HK$500　较7天前');
});

it('departurePrice: a date\'s own price, or the tour\'s stored from-price marked as a lowest price', () => {
  expect(departurePrice({ date: '2026-12-18', priceHkd: 7999 }, 7499)).toEqual({ hkd: 7999, from: false });
  expect(departurePrice({ date: '2026-12-27', priceHkd: null }, 7499)).toEqual({ hkd: 7499, from: true });
  // A price of 0 is a price (never treated as missing).
  expect(departurePrice({ date: '2026-12-28', priceHkd: 0 }, 7499)).toEqual({ hkd: 0, from: false });
});

it('departureDateText is null for a string that is not a real date', () => {
  expect(departureDateText('2026-02-30', tZh)).toBeNull();
  expect(departureDateText('soon', tZh)).toBeNull();
});
