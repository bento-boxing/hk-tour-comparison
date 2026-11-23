import { describe, it, expect } from 'vitest';
import { places, type PriceChange, type Stop, type TourPoint } from '@hktours/core';
import {
  departureDateText, departurePrice, lastUpdateDay, priceChangeText, regionParts, routeNames, staleSince, startNote,
  MAX_REGION_NAMES, STALE_AFTER_HOURS,
} from './card-text';
import { makeT, type T } from './i18n';

/** The region as the row writes it: the names with dots between them, the count of the rest after the last, no dot. */
const regionLabel = (stops: Stop[], index: typeof places, t: T = makeT('zh-Hant')) => {
  const { names, more } = regionParts(stops, index, t);
  return more > 0 ? `${names.join(' · ')} +${more}` : names.join(' · ');
};

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

it('the region label: within one country, the country once and then its regions in route order', () => {
  expect(regionLabel(kansaiStops, places)).toBe('日本 · 關西');
  expect(regionLabel([...kansaiStops, tokyoStop], places, tZh)).toBe('日本 · 關西 · 關東');
  expect(regionLabel([tokyoStop, ...kansaiStops, tokyoStop], places, tZh)).toBe('日本 · 關東 · 關西'); // each once
  const guilin: Stop = { countryId: 'china', regionId: 'china-guangxi', cityId: 'china-guangxi-guilin' };
  const zhaoqing: Stop = { countryId: 'china', regionId: 'china-guangdong', cityId: 'china-guangdong-zhaoqing' };
  expect(regionLabel([guilin, zhaoqing], places)).toBe('中國 · 廣西 · 廣東');
  expect(regionLabel([], places)).toBe('');
});

it('the region label: across several countries, the countries only, in route order', () => {
  expect(regionLabel([...kansaiStops, tokyoStop, seoulStop], places)).toBe('日本 · 韓國');
  expect(regionLabel([seoulStop, ...kansaiStops], places, tEn)).toBe('South Korea · Japan');
});

it(`the region label: at most ${MAX_REGION_NAMES} names, then +N; regionParts gives the names apart, each to be kept whole`, () => {
  const capital = (country: string) => places.data.regions.find(r => r.countryId === country)!;
  const countries = ['argentina', 'brazil', 'peru', 'chile', 'morocco', 'antarctica', 'france'];
  const stops = countries.map(c => ({ countryId: c, regionId: capital(c).id, cityId: null }));
  expect(regionLabel(stops.slice(0, 5), places)).toBe('阿根廷 · 巴西 · 秘魯 · 智利 · 摩洛哥');
  expect(regionLabel(stops, places)).toBe('阿根廷 · 巴西 · 秘魯 · 智利 · 摩洛哥 +2');
  expect(regionParts(stops, places)).toEqual({ names: ['阿根廷', '巴西', '秘魯', '智利', '摩洛哥'], more: 2 });
  // One country: the country is the first of the five names.
  const provinces = ['china-guangdong', 'china-guangxi', 'china-hunan', 'china-hubei', 'china-jiangxi', 'china-fujian']
    .map(regionId => ({ countryId: 'china', regionId, cityId: null }));
  expect(regionParts(provinces, places)).toEqual({ names: ['中國', '廣東', '廣西', '湖南', '湖北'], more: 2 });
});

it('the region label names the province of a stop that was in 華中 (task 37)', () => {
  const wuhan: Stop = { countryId: 'china', regionId: 'china-hubei', cityId: 'china-central-wuhan' };
  expect(regionLabel([wuhan], places)).toBe('中國 · 湖北');
  expect(regionLabel([wuhan], places, tEn)).toBe('China · Hubei');
  expect(routeNames([wuhan, { countryId: 'china', regionId: 'china-jiangxi', cityId: null }], places)).toEqual(['武漢', '江西']);
});

it('the region label reads a stop saved before 華中 was split by its city, or names the country alone (task 37)', () => {
  // Saved stops keep the old region id until the operator's next good run rewrites them.
  const savedWuhan: Stop = { countryId: 'china', regionId: 'china-central', cityId: 'china-central-wuhan' };
  const savedNanchang: Stop = { countryId: 'china', regionId: 'china-central', cityId: 'china-central-nanchang' };
  expect(regionLabel([savedWuhan], places)).toBe('中國 · 湖北');
  expect(regionLabel([savedWuhan, savedNanchang], places)).toBe('中國 · 湖北 · 江西');
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
  it('beside another region, 華中 is one more region, under the name it had', () => {
    expect(routeNames([hunan, saved華中], places, 'en')).toEqual(['Hunan', 'Central China']);
    expect(regionLabel([hunan, saved華中], places)).toBe('中國 · 湖南 · 華中');
    expect(regionLabel([saved華中, hunan], places, tEn)).toBe('China · Central China · Hunan');
  });
  it('a region unknown and not retired is left out of the label', () => {
    expect(regionLabel([city('japan-nowhere', null), tokyoStop], places)).toBe('日本 · 關東');
    expect(regionLabel([tokyoStop, city('japan-nowhere', null)], places)).toBe('日本 · 關東');
    expect(regionLabel([city('japan-nowhere', null)], places)).toBe('日本');
    expect(regionLabel([{ countryId: 'atlantis', regionId: 'atlantis-nowhere', cityId: null }], places)).toBe('');
  });
});

describe('stops saved before the five grouped regions became provinces (task 40)', () => {
  // Saved stops keep their old region id until the operator's next good run rewrites them.
  const savedHarbin: Stop = { countryId: 'china', regionId: 'china-northeast', cityId: 'china-northeast-harbin' };
  const savedNortheast: Stop = { countryId: 'china', regionId: 'china-northeast', cityId: null };
  const savedNorthwest: Stop = { countryId: 'china', regionId: 'china-northwest', cityId: null };
  const savedHangzhou: Stop = { countryId: 'china', regionId: 'china-shanghai', cityId: 'china-shanghai-hangzhou' };
  const savedShanghai: Stop = { countryId: 'china', regionId: 'china-shanghai', cityId: 'china-shanghai-shanghai' };
  const savedChongqing: Stop = { countryId: 'china', regionId: 'china-sichuan', cityId: 'china-sichuan-chongqing' };
  it('a city stop under a kept id (上海及華東 is now 上海) counts in its city\'s province', () => {
    expect(regionLabel([savedHangzhou], places)).toBe('中國 · 浙江');
    expect(regionLabel([savedShanghai, savedHangzhou], places, tEn)).toBe('China · Shanghai · Zhejiang');
    expect(regionLabel([savedChongqing], places, makeT('zh-Hans'))).toBe('中国 · 重庆');
    expect(routeNames([savedHangzhou, savedChongqing], places)).toEqual(['杭州', '重慶']);
  });
  it('a city stop under a retired id counts in its city\'s province', () => {
    expect(regionLabel([savedHarbin], places)).toBe('中國 · 黑龍江');
    expect(routeNames([savedHarbin], places, 'en')).toEqual(['Harbin']);
  });
  it.each([
    ['zh-Hant', tZh, '東北三省', '西北'],
    ['zh-Hans', makeT('zh-Hans'), '东北三省', '西北'],
    ['en', tEn, 'Northeast China', 'Northwest China'],
  ] as const)('a region-only stop under a retired id reads its old name in %s, never the id', (locale, t, northeast, northwest) => {
    expect(routeNames([savedNortheast, savedNorthwest], places, locale)).toEqual([northeast, northwest]);
    expect(regionLabel([savedNorthwest], places, t)).toContain(northwest);
    for (const text of [...routeNames([savedNortheast, savedNorthwest], places, locale), regionLabel([savedNortheast, savedNorthwest], places, t)]) {
      expect(text).not.toMatch(/china-/);
    }
  });
  it('a stop in an area (華東) still shows its name on the row, though the area is not offered as a destination', () => {
    const area: Stop = { countryId: 'china', regionId: 'china-area-east', cityId: null };
    expect(routeNames([area], places)).toEqual(['華東']);
    expect(routeNames([area], places, 'en')).toEqual(['East China']);
    expect(regionLabel([area], places)).toBe('中國 · 華東');
  });
  it('an old region-only 東北三省 beside an old city of it adds nothing', () => {
    expect(regionLabel([savedHarbin, savedNortheast], places)).toBe('中國 · 黑龍江');
  });
});

it('the region label names a country once when its region has the same name', () => {
  const paris: Stop = { countryId: 'france', regionId: 'france-france', cityId: 'france-france-paris' };
  const zurich: Stop = { countryId: 'switzerland', regionId: 'switzerland-switzerland', cityId: 'switzerland-switzerland-zurich' };
  expect(regionLabel([paris], places)).toBe('法國');
  expect(regionLabel([paris, zurich], places)).toBe('法國 · 瑞士');
  expect(regionLabel([...kansaiStops, paris], places)).toBe('日本 · 法國');
});

describe('an operator whose data is old', () => {
  it(`staleSince: the day of its last good run, once that is more than ${STALE_AFTER_HOURS} hours before now`, () => {
    const run = '2026-11-11T19:10:00Z'; // 03:10 on 12 Nov in Hong Kong
    expect(STALE_AFTER_HOURS).toBe(36);
    expect(staleSince(run, '2026-11-13T07:10:00Z', tZh)).toBeNull(); // exactly 36 hours
    expect(staleSince(run, '2026-11-13T07:11:00Z', tZh)).toBe('11月12日');
    expect(staleSince(run, '2026-11-20T00:00:00Z', tEn)).toBe('12 Nov');
    expect(staleSince('garbage', '2026-11-20T00:00:00Z', tZh)).toBeNull();
    expect(staleSince(run, 'garbage', tZh)).toBeNull();
  });

  it('lastUpdateDay: the latest good run of any operator, as a day; none when no operator has run', () => {
    const operators = [{ lastGoodRunAt: '2026-11-11T19:10:00Z' }, { lastGoodRunAt: null }, { lastGoodRunAt: '2026-11-18T18:40:00Z' }, { lastGoodRunAt: 'garbage' }];
    expect(lastUpdateDay(operators, tZh)).toBe('11月19日');
    expect(lastUpdateDay(operators, tEn)).toBe('19 Nov');
    expect(lastUpdateDay([{ lastGoodRunAt: null }], tZh)).toBeNull();
    expect(lastUpdateDay([], tZh)).toBeNull();
  });
});

it.each([
  [{ kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' }, '↓ 比7天前平 HK$500', 'down'],
  [{ kind: 'higher', diffHkd: 300, sinceDate: '2026-11-05' }, '↑ 比7天前貴 HK$300', 'up'],
  [{ kind: 'lower', diffHkd: 200, sinceDate: '2026-11-09' }, '↓ 比3天前平 HK$200', 'down'],
])('priceChangeText(%j): which way, since when, by how much', (change, text, tone) => {
  expect(priceChangeText(change as PriceChange, '2026-11-12', tZh)).toEqual({ text, tone });
});

it('priceChangeText is null for no change and for an unchanged price (only a change is noted)', () => {
  expect(priceChangeText(null, '2026-11-12', tZh)).toBeNull();
  for (const t of [tZh, tEn, makeT('zh-Hans')]) {
    expect(priceChangeText({ kind: 'same', sinceDate: '2026-11-05' }, '2026-11-12', t)).toBeNull();
  }
});

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

it('departureDateText gives the date with its weekday, the calendar date\'s own', () => {
  expect(departureDateText('2026-12-18', tZh)).toBe('2026年12月18日（五）');
  expect(departureDateText('2026-12-20', tZh)).toBe('2026年12月20日（日）');
  expect(departureDateText('2027-01-02', tZh)).toBe('2027年1月2日（六）');
  expect(departureDateText('2026-12-18', tEn)).toBe('Fri 18 Dec 2026');
  expect(departureDateText('2026-12-18', makeT('zh-Hans'))).toBe('2026年12月18日（周五）');
});

it('routeNames and the region label name the places in the visitor\'s language', () => {
  expect(routeNames(kansaiStops, places, 'en')).toEqual(['Osaka', 'Kyoto', 'Nara', 'Kobe']);
  expect(routeNames([seoulStop, city('japan-hokkaido', null)], places, 'zh-Hans')).toEqual(['首尔', '北海道']);
  expect(regionLabel([...kansaiStops, tokyoStop], places, tEn)).toBe('Japan · Kansai · Kanto');
  expect(regionLabel([seoulStop], places, makeT('zh-Hans'))).toBe('韩国 · 首尔及京畿');
  // A region named like its country is still named once.
  expect(regionLabel([city('france-france', 'france-france-paris')], places, tEn)).toBe('France');
});

it.each([
  [{ kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' }, '↓ HK$500 less than 7 days ago'],
  [{ kind: 'higher', diffHkd: 300, sinceDate: '2026-11-11' }, '↑ HK$300 more than 1 day ago'],
])('priceChangeText in English (%j): the drawing E1\'s wording, one breakable space (before "than")', (change, text) => {
  const got = priceChangeText(change as PriceChange, '2026-11-12', tEn)?.text;
  expect(got?.replace(/\u00a0/g, ' ')).toBe(text);
  expect(got?.split(' ')).toHaveLength(2);
});

it('priceChangeText in Simplified Chinese', () => {
  const change: PriceChange = { kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' };
  expect(priceChangeText(change, '2026-11-12', makeT('zh-Hans'))?.text).toBe('↓ 比7天前便宜 HK$500');
  expect(priceChangeText({ ...change, kind: 'higher' }, '2026-11-12', makeT('zh-Hans'))?.text).toBe('↑ 比7天前贵 HK$500');
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
