import { it, expect } from 'vitest';
import rawData from './data.json';
import zhHansNames from './names.zh-Hans.json';
import { zhHansName } from './zh-hans';
import { places, type PlacesData } from './index';
import { suggestRegions } from '../suggest';

const data = rawData as PlacesData;
const map = zhHansNames as Record<string, string>;

it('has a Simplified name for every country, region and city name and alias (rerun scripts/gen-zh-hans-names.py if not)', () => {
  const missing = [...data.countries, ...data.regions, ...data.cities]
    .flatMap(p => [p.nameZh, ...p.aliases])
    .filter(name => typeof map[name] !== 'string' || map[name] === '');
  expect(missing).toEqual([]);
});

it('converts characters, and uses the mainland name where it differs in more than characters', () => {
  expect(zhHansName('韓國')).toBe('韩国');
  expect(zhHansName('關西')).toBe('关西');
  expect(zhHansName('東京')).toBe('东京');
  expect(zhHansName('日本')).toBe('日本');
  expect(zhHansName('紐西蘭')).toBe('新西兰');
  expect(zhHansName('澳洲')).toBe('澳大利亚');
  expect(zhHansName('峇里島')).toBe('巴厘岛');
  expect(zhHansName('三藩市')).toBe('旧金山');
});

it('falls back to the name as given when it has no entry', () => {
  expect(zhHansName('甲國')).toBe('甲國');
});

it('search suggestions match Simplified names and aliases', () => {
  expect(suggestRegions('东京', places)[0].destination).toEqual({ countryId: 'japan', regionId: 'japan-kanto' });
  expect(suggestRegions('韩国', places)[0].destination).toEqual({ countryId: 'korea', regionId: null });
  expect(suggestRegions('南韩', places)[0].destination).toEqual({ countryId: 'korea', regionId: null });
  expect(suggestRegions('新西兰', places)[0].destination).toEqual({ countryId: 'new-zealand', regionId: null });
  // Traditional and English still match.
  expect(suggestRegions('東京', places)[0].destination).toEqual({ countryId: 'japan', regionId: 'japan-kanto' });
  expect(suggestRegions('Tokyo', places)[0].destination).toEqual({ countryId: 'japan', regionId: 'japan-kanto' });
});

it('mainland names for foreign cities, and both the Hong Kong and the mainland name find the city', () => {
  const cases: [string, string, string][] = [
    ['杜拜', '迪拜', 'uae'], ['佛羅倫斯', '佛罗伦萨', 'italy'], ['巴塞隆拿', '巴塞罗那', 'spain'],
    ['伊斯坦堡', '伊斯坦布尔', 'turkey'], ['薩爾斯堡', '萨尔茨堡', 'austria'], ['拿坡里', '那不勒斯', 'italy'],
    ['但尼丁', '达尼丁', 'new-zealand'], ['夏灣拿', '哈瓦那', 'cuba'], ['蒙地卡羅', '蒙特卡洛', 'monaco'],
    ['布里斯本', '布里斯班', 'australia'],
  ];
  for (const [hk, mainland, countryId] of cases) {
    expect(zhHansName(hk), hk).toBe(mainland);
    expect(suggestRegions(hk, places)[0]?.destination.countryId, hk).toBe(countryId);
    expect(suggestRegions(mainland, places)[0]?.destination.countryId, mainland).toBe(countryId);
  }
  expect(zhHansName('南澳洲')).toBe('南澳大利亚');
  expect(zhHansName('西澳')).toBe('西澳大利亚');
});
