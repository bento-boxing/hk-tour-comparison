import { it, expect } from 'vitest';
import { suggestRegions, places, buildPlacesIndex, ALL_REGIONS_LABEL, type PlacesData } from './index';

const labels = (q: string) => suggestRegions(q, places).map(s => s.label);

it('a city suggests its region', () => {
  expect(suggestRegions('大阪', places)[0]).toEqual({
    destination: { countryId: 'japan', regionId: 'japan-kansai' }, label: '日本 → 關西', via: '大阪',
  });
});
it('a region suggests itself', () => {
  expect(labels('關西')[0]).toBe('日本 → 關西');
  expect(suggestRegions('關西', places)[0].via).toBeNull();
});
it('a country suggests all-regions first, then its regions', () => {
  const l = labels('日本');
  expect(l[0]).toBe('日本 → 全部地區');
  expect(l).toContain('日本 → 北海道');
  expect(suggestRegions('日本', places)[0]).toEqual({
    destination: { countryId: 'japan', regionId: null }, label: `日本 → ${ALL_REGIONS_LABEL}`, via: null,
  });
});
it('prefix matches work while typing', () => { expect(labels('北海')).toContain('日本 → 北海道'); });
it('alias and English work', () => {
  expect(labels('漢城')[0]).toBe('韓國 → 首爾及京畿');
  expect(labels('Osaka')[0]).toBe('日本 → 關西');
});
it('English matching ignores case and spaces, and labels stay Chinese', () => {
  expect(labels('OSAKA')[0]).toBe('日本 → 關西');
  expect(labels('tok')[0]).toBe('日本 → 關東');
  expect(labels('japan')[0]).toBe('日本 → 全部地區');
  expect(labels('hong kong')[0]).toBe('香港 → 全部地區');
});
it('nothing for empty, whitespace or unknown input', () => {
  expect(labels('')).toEqual([]); expect(labels('   ')).toEqual([]); expect(labels('亞特蘭提斯')).toEqual([]);
});
// Task 3's shared-name index: 聖城 in 甲國/甲區 and 乙國/乙區, each country with one region.
const oneRegionEach: PlacesData = {
  countries: [{ id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [], group: 'europe' }, { id: 'b', nameZh: '乙國', nameEn: 'B', aliases: [], group: 'europe' }],
  regions: [{ id: 'a-r', countryId: 'a', nameZh: '甲區', nameEn: '', aliases: [] }, { id: 'b-r', countryId: 'b', nameZh: '乙區', nameEn: '', aliases: [] }],
  cities: [{ id: 'a-r-x', regionId: 'a-r', nameZh: '聖城', nameEn: '', aliases: [] }, { id: 'b-r-x', regionId: 'b-r', nameZh: '聖城', nameEn: '', aliases: [] }],
};
// The same, with a second region in each country.
const twoRegionsEach = {
  ...oneRegionEach,
  regions: [
    ...oneRegionEach.regions,
    { id: 'a-s', countryId: 'a', nameZh: '甲二區', nameEn: '', aliases: [] }, { id: 'b-s', countryId: 'b', nameZh: '乙二區', nameEn: '', aliases: [] },
  ],
};

it('same-named cities in two countries give two distinguishable labels', () => {
  const idx = buildPlacesIndex(twoRegionsEach);
  // Each exact city row is followed by its own country's 全部地區 row.
  expect(suggestRegions('聖城', idx)).toEqual([
    { destination: { countryId: 'a', regionId: 'a-r' }, label: '甲國 → 甲區', via: '聖城' },
    { destination: { countryId: 'a', regionId: null }, label: `甲國 → ${ALL_REGIONS_LABEL}`, via: null },
    { destination: { countryId: 'b', regionId: 'b-r' }, label: '乙國 → 乙區', via: '聖城' },
    { destination: { countryId: 'b', regionId: null }, label: `乙國 → ${ALL_REGIONS_LABEL}`, via: null },
  ]);
});
it('a region name shared by several countries suggests each of them', () => {
  expect(labels('北部').slice(0, 6)).toEqual([
    '台灣 → 北部', '台灣 → 全部地區', '泰國 → 北部', '泰國 → 全部地區', '越南 → 北部', '越南 → 全部地區',
  ]);
  expect(labels('中部').slice(0, 4)).toEqual(['台灣 → 中部', '台灣 → 全部地區', '越南 → 中部', '越南 → 全部地區']);
});
it('exact matches come before prefix matches, prefix before contains', () => {
  // city 京都 starts with 京; region alias 京畿 starts with 京; cities 東京, 北京, 南京 only contain it
  expect(suggestRegions('京', places)).toEqual([
    { destination: { countryId: 'japan', regionId: 'japan-kansai' }, label: '日本 → 關西', via: '京都' },
    { destination: { countryId: 'korea', regionId: 'korea-seoul' }, label: '韓國 → 首爾及京畿', via: null },
    { destination: { countryId: 'japan', regionId: 'japan-kanto' }, label: '日本 → 關東', via: '東京' },
    { destination: { countryId: 'china', regionId: 'china-beijing' }, label: '中國 → 北京及華北', via: '北京' },
    { destination: { countryId: 'china', regionId: 'china-shanghai' }, label: '中國 → 上海及華東', via: '南京' },
  ]);
});
it('aliases count in prefix matches for regions and countries', () => {
  // 婆羅洲 is an alias of 東馬; 中國內地 is an alias of 中國
  expect(suggestRegions('婆羅', places)).toEqual([
    { destination: { countryId: 'malaysia', regionId: 'malaysia-borneo' }, label: '馬來西亞 → 東馬', via: null },
  ]);
  expect(labels('中國內')).toEqual(['中國 → 全部地區']);
});
it('aliases count in substring matches, and via is still the city nameZh', () => {
  // 口湖 is inside the aliases 富士河口湖 and 河口湖 of 富士山, and no name starts with it
  expect(suggestRegions('口湖', places)).toEqual([
    { destination: { countryId: 'japan', regionId: 'japan-chubu' }, label: '日本 → 中部北陸', via: '富士山' },
  ]);
});
it('normalises 臺 in the query', () => { expect(labels('臺北')[0]).toBe('台灣 → 北部'); });
it('never returns duplicates and respects the limit', () => {
  const r = suggestRegions('日本', places, 3);
  expect(r.length).toBe(3);
  expect(new Set(r.map(s => s.label)).size).toBe(3);
  const all = suggestRegions('日本', places, 100);
  expect(all.length).toBe(10); // 全部地區 + 9 regions
  expect(new Set(all.map(s => s.label)).size).toBe(all.length);
  expect(suggestRegions('日本', places).length).toBe(8);
});

it('an exact city offers its country-wide row straight after its region (mockup)', () => {
  expect(labels('大阪').slice(0, 2)).toEqual(['日本 → 關西', '日本 → 全部地區']);
  expect(suggestRegions('大阪', places)[1]).toEqual({
    destination: { countryId: 'japan', regionId: null }, label: `日本 → ${ALL_REGIONS_LABEL}`, via: null,
  });
});
it('an exact region offers its country-wide row straight after it', () => {
  expect(labels('關西').slice(0, 2)).toEqual(['日本 → 關西', '日本 → 全部地區']);
});
it('an exact country still offers 全部地區 first and only once', () => {
  const l = suggestRegions('日本', places, 100).map(s => s.label);
  expect(l[0]).toBe('日本 → 全部地區');
  expect(l.filter(x => x === '日本 → 全部地區')).toHaveLength(1);
  expect(l.slice(1)).toEqual(places.regionsOf('japan').map(r => `日本 → ${r.nameZh}`));
});
it('prefix and contains matches do not add a country-wide row', () => {
  expect(labels('婆羅')).toEqual(['馬來西亞 → 東馬']);
  expect(labels('口湖')).toEqual(['日本 → 中部北陸']);
});
it('the country-wide rows count towards the limit', () => {
  expect(suggestRegions('大阪', places, 1).map(s => s.label)).toEqual(['日本 → 關西']);
  expect(suggestRegions('北部', places, 3).map(s => s.label)).toEqual(['台灣 → 北部', '台灣 → 全部地區', '泰國 → 北部']);
});

it('a single-region country gives one country-wide row, never a region row as well', () => {
  // 新加坡 is a city, the only region and the country; 巴黎 is a city in 法國's only region.
  expect(suggestRegions('新加坡', places)).toEqual([
    { destination: { countryId: 'singapore', regionId: null }, label: `新加坡 → ${ALL_REGIONS_LABEL}`, via: '新加坡' },
  ]);
  expect(suggestRegions('巴黎', places)).toEqual([
    { destination: { countryId: 'france', regionId: null }, label: `法國 → ${ALL_REGIONS_LABEL}`, via: '巴黎' },
  ]);
  expect(suggestRegions('Paris', places)).toEqual(suggestRegions('巴黎', places));
  // 法國 matches the region and the country, but not a city: no via.
  expect(suggestRegions('法國', places)).toEqual([
    { destination: { countryId: 'france', regionId: null }, label: `法國 → ${ALL_REGIONS_LABEL}`, via: null },
  ]);
  expect(labels('france')).toEqual(['法國 → 全部地區']);
});
it('single-region countries reached by prefix or contains matches also give the country-wide row, keeping via', () => {
  // Only the single-region countries' rows: a multi-region country's region (西藏, via 巴松措) may come first.
  const l = suggestRegions('巴', places).filter(s => places.regionsOf(s.destination.countryId).length === 1);
  expect(l.slice(0, 2)).toEqual([
    { destination: { countryId: 'france', regionId: null }, label: '法國 → 全部地區', via: '巴黎' },
    { destination: { countryId: 'germany', regionId: null }, label: '德國 → 全部地區', via: '巴登巴登' },
  ]);
  expect(l.every(s => s.destination.regionId === null)).toBe(true);
  // 雲南 (via 瑞麗) and 忠清道 (via 瑞山) are regions of multi-region countries, so they stay region rows;
  // 摩洛哥 comes via 瑞薩尼 (Rissani).
  expect(labels('瑞')).toEqual(['韓國 → 忠清道', '中國 → 雲南', '摩洛哥 → 全部地區', '瑞士 → 全部地區', '瑞典 → 全部地區']);
});
it('same-named cities in two single-region countries give one row per country', () => {
  expect(suggestRegions('聖城', buildPlacesIndex(oneRegionEach))).toEqual([
    { destination: { countryId: 'a', regionId: null }, label: `甲國 → ${ALL_REGIONS_LABEL}`, via: '聖城' },
    { destination: { countryId: 'b', regionId: null }, label: `乙國 → ${ALL_REGIONS_LABEL}`, via: '聖城' },
  ]);
});
it('no suggestion list holds a region row of a single-region country', () => {
  const single = new Set(places.data.countries.filter(c => places.regionsOf(c.id).length === 1).map(c => c.id));
  for (const q of ['新加坡', '香港', '澳門', '法國', '德國', '瑞', '巴', '亞', '斯', 'a', 'ber']) {
    for (const s of suggestRegions(q, places, 100)) {
      if (single.has(s.destination.countryId)) expect(s.destination.regionId, `${q}: ${s.label}`).toBeNull();
    }
  }
});
