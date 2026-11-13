import { describe, it, expect } from 'vitest';
import { extractStops, places, buildPlacesIndex } from './index';
import type { PlacesIndex, StopsResult } from './index';

/** Maps stops to city nameZh, or region nameZh when cityId is null. */
function names(r: StopsResult, index: PlacesIndex = places): string[] {
  return r.stops.map(s => (s.cityId !== null ? index.city(s.cityId)!.nameZh : index.region(s.regionId)!.nameZh));
}

describe('extractStops', () => {
  it.each([
    [['第一天 香港 → 大阪', '第二天 大阪 → 京都 → 奈良', '第三天 奈良 → 神戶', '第四天 神戶 → 大阪 → 香港'],
      ['大阪', '京都', '奈良', '神戶', '大阪'], []],
    [['Day 1: 香港✈首爾', 'Day 2 首爾－南怡島－江陵', 'DAY3 江陵 / 首爾', 'D4 首爾 ✈ 香港'],
      ['首爾', '南怡島', '江陵', '首爾'], []],
    [['第1日：香港 ～ 東京（成田機場）', '第2日：東京市內觀光'], ['東京'], []],
    [['香港 → 北海道', '札幌 → 小樽'], ['北海道', '札幌', '小樽'], []],
    [['香港 → 日本'], [], []],
    [['香港 → 大阪 → 亞特蘭提斯'], ['大阪'], ['亞特蘭提斯']],
    [['大阪 → 大阪 → 京都 → 京都'], ['大阪', '京都'], []],
    [['全日自由活動', '酒店 → 機場 → 香港'], [], []],
    [[], [], []],
  ])('extractStops(%j)', (headings, expectedNames, expectedUnmatched) => {
    const r = extractStops(headings, places);
    expect(names(r)).toEqual(expectedNames);
    expect(r.unmatched).toEqual(expectedUnmatched);
  });

  it('fills country and region ids', () => {
    expect(extractStops(['香港 → 大阪'], places).stops).toEqual([
      { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' },
    ]);
  });

  it('excludes a custom start city', () => {
    const r = extractStops(['深圳 → 桂林 → 陽朔 → 深圳'], places,
      ['hongkong-hongkong-hongkong', 'china-guangdong-shenzhen']);
    expect(names(r)).toEqual(['桂林', '陽朔']);
  });

  it('resolves a shared name using earlier stops, and flags it when it cannot', () => {
    const index = buildPlacesIndex({
      countries: [
        { id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [] },
        { id: 'b', nameZh: '乙國', nameEn: 'B', aliases: [] },
      ],
      regions: [
        { id: 'a-r', countryId: 'a', nameZh: '甲區', nameEn: 'AR', aliases: [] },
        { id: 'b-r', countryId: 'b', nameZh: '乙區', nameEn: 'BR', aliases: [] },
      ],
      cities: [
        { id: 'b-r-x', regionId: 'b-r', nameZh: '聖城', nameEn: 'BX', aliases: [] },
        { id: 'a-r-x', regionId: 'a-r', nameZh: '聖城', nameEn: 'AX', aliases: [] },
        { id: 'a-r-y', regionId: 'a-r', nameZh: '甲市', nameEn: 'AY', aliases: [] },
      ],
    });

    const resolved = extractStops(['甲市 → 聖城'], index);
    expect(resolved.stops).toEqual([
      { countryId: 'a', regionId: 'a-r', cityId: 'a-r-y' },
      { countryId: 'a', regionId: 'a-r', cityId: 'a-r-x' },
    ]);
    expect(resolved.unmatched).toEqual([]);

    const flagged = extractStops(['聖城'], index);
    expect(flagged.stops).toEqual([{ countryId: 'b', regionId: 'b-r', cityId: 'b-r-x' }]);
    expect(flagged.unmatched).toEqual(['聖城']);
  });

  it('resolves a region name shared across countries the same way', () => {
    const resolved = extractStops(['曼谷 → 北部'], places);
    expect(resolved.stops[1]).toEqual({ countryId: 'thailand', regionId: 'thailand-north', cityId: null });
    expect(resolved.unmatched).toEqual([]);
    expect(extractStops(['北部'], places).unmatched).toEqual(['北部']);
  });

  it('splits on the emoji form of ✈', () => {
    const r = extractStops(['Day 1 香港✈️北海道'], places);
    expect(names(r)).toEqual(['北海道']);
    expect(r.unmatched).toEqual([]);
  });

  it('reads only the place part of each heading', () => {
    // day markers in every listed form, brackets of every listed kind, every listed separator
    const r = extractStops([
      '第 1 日 - 香港 → 大阪',
      'DAY2：京都(嵐山)【世界遺產】[午餐]',
      'D3 奈良➝神戶⇒姬路~廣島－岡山–高松—松山>福岡＞長崎／熊本、別府，由布院,那霸｜札幌|小樽',
    ], places);
    expect(names(r)).toEqual([
      '大阪', '京都', '奈良', '神戶', '姬路', '廣島', '岡山', '高松', '松山',
      '福岡', '長崎', '熊本', '別府', '由布院', '那霸', '札幌', '小樽',
    ]);
    expect(r.unmatched).toEqual([]);
  });

  it('keeps non-consecutive repeats and de-duplicates unmatched in order of first appearance', () => {
    const r = extractStops(['大阪 → 亞特蘭提斯 → 京都', '京都 → 大阪 → 天空之城 → 亞特蘭提斯'], places);
    expect(names(r)).toEqual(['大阪', '京都', '大阪']);
    expect(r.unmatched).toEqual(['亞特蘭提斯', '天空之城']);
  });

  it('collapses a repeat made consecutive by dropping an excluded city', () => {
    expect(names(extractStops(['大阪 → 香港 → 大阪'], places))).toEqual(['大阪']);
  });

  it('ignores Latin, single-character and over-long tokens instead of reporting them', () => {
    const r = extractStops(['Osaka 城 → 一個非常非常長的地方名字', '大阪'], places);
    expect(names(r)).toEqual(['大阪']);
    expect(r.unmatched).toEqual([]);
  });

  it('does not read 松山湖 (Dongguan) as Matsuyama', () => {
    const r = extractStops(['香港 → 東莞 → 松山湖'], places);
    expect(names(r)).toEqual(['東莞']);
    expect(r.unmatched).toEqual(['松山湖']);
  });

  it('does not read 西貢 (Sai Kung, Hong Kong) as Ho Chi Minh City', () => {
    expect(places.findCity('西貢')).toEqual([]);
    expect(extractStops(['西貢'], places).stops).toEqual([]);
    expect(names(extractStops(['香港 → 胡志明市'], places))).toEqual(['胡志明市']);
  });
});

describe('extractStops with notPlaces', () => {
  // 松山 is a city; 松山湖 contains it but is not it.
  const index = buildPlacesIndex({
    countries: [{ id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [] }],
    regions: [{ id: 'a-r', countryId: 'a', nameZh: '甲區', nameEn: 'R', aliases: [] }],
    cities: [
      { id: 'a-r-matsuyama', regionId: 'a-r', nameZh: '松山', nameEn: 'Matsuyama', aliases: [] },
      { id: 'a-r-osaka', regionId: 'a-r', nameZh: '大阪', nameEn: 'Osaka', aliases: [] },
      { id: 'a-r-lake', regionId: 'a-r', nameZh: '湖城', nameEn: 'Lake City', aliases: [] },
    ],
    notPlaces: ['松山湖'],
  });

  it.each([
    ['松山湖', [], ['松山湖']],                 // the entry itself
    ['松山湖畔', [], ['松山湖畔']],             // a token containing the entry
    ['【大阪】松山湖', [], ['松山湖']],         // brackets are dropped before matching, as always
    ['大阪松山湖', ['大阪'], []],               // a city outside the entry still matches
    ['松山湖松山', ['松山'], []],               // so does the same city name outside the entry
    ['松山湖城', ['湖城'], []],                 // and a city name only partly inside it
    ['松山', ['松山'], []],                     // an exact city name is unaffected
    ['松山市', ['松山'], []],                   // as is a token without the entry
  ])('extractStops([%j])', (heading, expectedNames, expectedUnmatched) => {
    const r = extractStops([heading], index);
    expect(names(r, index)).toEqual(expectedNames);
    expect(r.unmatched).toEqual(expectedUnmatched);
  });

  it('treats a missing notPlaces list as empty', () => {
    const { notPlaces: _ignored, ...withoutList } = index.data;
    expect(names(extractStops(['松山湖'], buildPlacesIndex(withoutList)), index)).toEqual(['松山']);
  });
});
