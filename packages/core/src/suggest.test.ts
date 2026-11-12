import { it, expect } from 'vitest';
import { suggestRegions, places, buildPlacesIndex, ALL_REGIONS_LABEL } from './index';

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
  expect(labels('hong kong')[0]).toBe('香港 → 香港');
});
it('nothing for empty, whitespace or unknown input', () => {
  expect(labels('')).toEqual([]); expect(labels('   ')).toEqual([]); expect(labels('亞特蘭提斯')).toEqual([]);
});
it('same-named cities in two countries give two distinguishable labels', () => {
  // tiny index from Task 3's shared-name test: 聖城 in 甲國/甲區 and 乙國/乙區
  const idx = buildPlacesIndex({
    countries: [{ id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [] }, { id: 'b', nameZh: '乙國', nameEn: 'B', aliases: [] }],
    regions: [{ id: 'a-r', countryId: 'a', nameZh: '甲區', nameEn: '', aliases: [] }, { id: 'b-r', countryId: 'b', nameZh: '乙區', nameEn: '', aliases: [] }],
    cities: [{ id: 'a-r-x', regionId: 'a-r', nameZh: '聖城', nameEn: '', aliases: [] }, { id: 'b-r-x', regionId: 'b-r', nameZh: '聖城', nameEn: '', aliases: [] }],
  });
  expect(suggestRegions('聖城', idx)).toEqual([
    { destination: { countryId: 'a', regionId: 'a-r' }, label: '甲國 → 甲區', via: '聖城' },
    { destination: { countryId: 'b', regionId: 'b-r' }, label: '乙國 → 乙區', via: '聖城' },
  ]);
});
it('a region name shared by several countries suggests each of them', () => {
  expect(labels('北部').slice(0, 3)).toEqual(['台灣 → 北部', '泰國 → 北部', '越南 → 北部']);
  expect(labels('中部').slice(0, 2)).toEqual(['台灣 → 中部', '越南 → 中部']);
});
it('exact matches come before prefix matches, prefix before contains', () => {
  // 京都 starts with 京; cities 東京, 北京, 南京 only contain it; then regions containing it:
  // 北京及華北 is already given by 北京, 首爾及京畿 is new (its alias 京畿 is not a name, so no prefix match)
  expect(suggestRegions('京', places)).toEqual([
    { destination: { countryId: 'japan', regionId: 'japan-kansai' }, label: '日本 → 關西', via: '京都' },
    { destination: { countryId: 'japan', regionId: 'japan-kanto' }, label: '日本 → 關東', via: '東京' },
    { destination: { countryId: 'china', regionId: 'china-beijing' }, label: '中國 → 北京及華北', via: '北京' },
    { destination: { countryId: 'china', regionId: 'china-shanghai' }, label: '中國 → 上海及華東', via: '南京' },
    { destination: { countryId: 'korea', regionId: 'korea-seoul' }, label: '韓國 → 首爾及京畿', via: null },
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
