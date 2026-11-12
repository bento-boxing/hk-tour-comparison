import { describe, it, expect } from 'vitest';
import { places, buildPlacesIndex, normaliseName } from './index';
import type { PlacesData } from './index';
import rawData from './data.json';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Returns every consistency problem in a places list; empty means consistent. */
function consistencyProblems(data: PlacesData): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const countryIds = new Set(data.countries.map(c => c.id));
  const regionIds = new Set(data.regions.map(r => r.id));
  const checkId = (id: string, parentId?: string) => {
    if (seen.has(id)) problems.push(`duplicate id ${id}`);
    seen.add(id);
    if (!SLUG.test(id)) problems.push(`bad slug ${id}`);
    if (parentId !== undefined && !id.startsWith(`${parentId}-`)) problems.push(`${id} does not start with ${parentId}-`);
  };
  for (const c of data.countries) checkId(c.id);
  for (const r of data.regions) {
    checkId(r.id, r.countryId);
    if (!countryIds.has(r.countryId)) problems.push(`region ${r.id} has unknown country ${r.countryId}`);
  }
  for (const c of data.cities) {
    checkId(c.id, c.regionId);
    if (!regionIds.has(c.regionId)) problems.push(`city ${c.id} has unknown region ${c.regionId}`);
  }
  return problems;
}

describe('places', () => {
  it('finds a city by name', () => {
    expect(places.findCity('大阪').map(c => c.id)).toEqual(['japan-kansai-osaka']);
  });
  it('finds a city by alias and normalises 臺', () => {
    expect(places.findCity('漢城')[0].id).toBe('korea-seoul-seoul');
    expect(places.findCity('臺北')[0].id).toBe('taiwan-north-taipei');
    expect(places.findCity(' 大 阪 ')[0].id).toBe('japan-kansai-osaka');
  });
  it('walks city → region → country', () => {
    const city = places.findCity('京都')[0];
    expect(places.region(city.regionId)!.nameZh).toBe('關西');
    expect(places.country(places.region(city.regionId)!.countryId)!.nameZh).toBe('日本');
  });
  it('lists regions and cities', () => {
    expect(places.regionsOf('japan').length).toBe(9);
    expect(places.citiesOf('japan-kansai').map(c => c.nameZh)).toContain('神戶');
  });
  it('returns [] for unknown names', () => { expect(places.findCity('亞特蘭提斯')).toEqual([]); });
  it('returns every match when a name is shared', () => {
    const idx = buildPlacesIndex({
      countries: [{ id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [] }, { id: 'b', nameZh: '乙國', nameEn: 'B', aliases: [] }],
      regions: [{ id: 'a-r', countryId: 'a', nameZh: '甲區', nameEn: '', aliases: [] }, { id: 'b-r', countryId: 'b', nameZh: '乙區', nameEn: '', aliases: [] }],
      cities: [{ id: 'a-r-x', regionId: 'a-r', nameZh: '聖城', nameEn: '', aliases: [] }, { id: 'b-r-x', regionId: 'b-r', nameZh: '聖城', nameEn: '', aliases: [] }],
    });
    expect(idx.findCity('聖城').length).toBe(2);
  });
  it('data.json is internally consistent', () => {
    expect(consistencyProblems(rawData as PlacesData)).toEqual([]);
    expect(places.data.countries.length).toBeGreaterThan(0);
    expect(places.data.regions.length).toBeGreaterThan(0);
    expect(places.data.cities.length).toBeGreaterThan(0);
  });
  it('the consistency check catches a dangling reference, a duplicate id and a bad prefix', () => {
    const base: PlacesData = {
      countries: [{ id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [] }],
      regions: [{ id: 'a-r', countryId: 'a', nameZh: '甲區', nameEn: 'R', aliases: [] }],
      cities: [{ id: 'a-r-x', regionId: 'a-r', nameZh: '聖城', nameEn: 'X', aliases: [] }],
    };
    expect(consistencyProblems(base)).toEqual([]);
    expect(consistencyProblems({ ...base, cities: [{ ...base.cities[0], id: 'zz-r-x', regionId: 'zz-r' }] }))
      .toContain('city zz-r-x has unknown region zz-r');
    expect(consistencyProblems({ ...base, regions: [...base.regions, { ...base.regions[0], countryId: 'zz', id: 'zz-q' }] }))
      .toContain('region zz-q has unknown country zz');
    expect(consistencyProblems({ ...base, cities: [...base.cities, base.cities[0]] })).toContain('duplicate id a-r-x');
    expect(consistencyProblems({ ...base, cities: [{ ...base.cities[0], id: 'b-r-x' }] }))
      .toContain('b-r-x does not start with a-r-');
    expect(consistencyProblems({ ...base, countries: [{ ...base.countries[0], id: 'A' }], regions: [], cities: [] }))
      .toContain('bad slug A');
  });
  it('every entry has a Chinese and an English name', () => {
    const all = [...places.data.countries, ...places.data.regions, ...places.data.cities];
    for (const p of all) {
      expect(p.nameZh, p.id).not.toBe('');
      expect(p.nameEn, p.id).not.toBe('');
    }
  });
});

describe('seed list', () => {
  const seedCities: Record<string, string[]> = {
    'japan-hokkaido': ['札幌', '函館', '小樽'],
    'japan-tohoku': ['仙台'],
    'japan-kanto': ['東京', '橫濱', '箱根', '日光'],
    'japan-chubu': ['名古屋', '金澤', '高山', '富士山'],
    'japan-kansai': ['大阪', '京都', '奈良', '神戶', '姬路', '白濱'],
    'japan-chugoku': ['廣島', '岡山'],
    'japan-shikoku': ['高松', '松山'],
    'japan-kyushu': ['福岡', '長崎', '熊本', '鹿兒島', '別府', '由布院'],
    'japan-okinawa': ['那霸'],
    'korea-seoul': ['首爾', '南怡島'],
    'korea-gangwon': ['江陵'],
    'korea-busan': ['釜山', '慶州', '大邱'],
    'korea-jeju': ['濟州'],
    'taiwan-north': ['台北', '九份', '宜蘭'],
    'taiwan-central': ['台中', '日月潭', '阿里山'],
    'taiwan-south': ['高雄', '台南', '墾丁'],
    'taiwan-east': ['花蓮', '台東'],
    'thailand-bangkok': ['曼谷', '芭堤雅', '華欣'],
    'thailand-north': ['清邁', '清萊'],
    'thailand-south': ['布吉', '蘇梅', '喀比'],
    'china-guangdong': ['廣州', '深圳', '珠海', '潮州', '汕頭'],
    'china-beijing': ['北京', '天津'],
    'china-shanghai': ['上海', '杭州', '蘇州', '南京'],
    'china-sichuan': ['成都', '重慶', '九寨溝'],
    'china-yunnan': ['昆明', '大理', '麗江'],
    'china-guangxi': ['桂林', '陽朔'],
    'china-fujian': ['廈門'],
    'china-hunan': ['張家界', '長沙'],
    'china-shandong': ['青島', '蓬萊'],
    'china-xinjiang': ['烏魯木齊'],
    'china-tibet': ['拉薩'],
    'vietnam-north': ['河內', '下龍灣'],
    'vietnam-central': ['峴港', '會安'],
    'vietnam-south': ['胡志明市'],
    'singapore-singapore': ['新加坡'],
    'malaysia-peninsular': ['吉隆坡', '檳城', '馬六甲'],
    'malaysia-borneo': ['沙巴'],
    'hongkong-hongkong': ['香港'],
    'macau-macau': ['澳門'],
  };

  it.each(Object.entries(seedCities))('%s holds its seed cities', (regionId, names) => {
    const inRegion = places.citiesOf(regionId).map(c => c.nameZh);
    for (const name of names) expect(inRegion, `${regionId} ${name}`).toContain(name);
  });

  it('has the seed countries and region counts', () => {
    const counts = Object.fromEntries(places.data.countries.map(c => [c.id, places.regionsOf(c.id).length]));
    expect(counts).toEqual({
      japan: 9, korea: 4, taiwan: 4, thailand: 3, china: 11, vietnam: 3,
      singapore: 1, malaysia: 2, hongkong: 1, macau: 1,
    });
  });

  it('resolves the aliases the seed table names', () => {
    expect(places.findCity('富士河口湖')[0].id).toBe('japan-chubu-mount-fuji');
    expect(places.findCity('芭達雅')[0].id).toBe('thailand-bangkok-pattaya');
    expect(places.findCity('普吉')[0].id).toBe('thailand-south-phuket');
    expect(places.findCity('亞庇')[0].id).toBe('malaysia-borneo-sabah');
  });

  it('uses the agreed ids for cities later tasks depend on', () => {
    const ids = [
      'japan-kansai-osaka', 'korea-seoul-seoul', 'taiwan-north-taipei', 'china-guangxi-guilin',
      'china-guangdong-shenzhen', 'hongkong-hongkong-hongkong', 'japan-kanto-tokyo', 'japan-kansai-kyoto',
    ];
    for (const id of ids) expect(places.city(id), id).toBeDefined();
  });
});

describe('lookups', () => {
  it('finds regions and countries by name and alias', () => {
    expect(places.findRegion('關西').map(r => r.id)).toEqual(['japan-kansai']);
    expect(places.findCountry('日本').map(c => c.id)).toEqual(['japan']);
    expect(places.findCountry('臺灣').map(c => c.id)).toEqual(['taiwan']);
  });
  it('returns [] for unknown ids and names', () => {
    expect(places.country('atlantis')).toBeUndefined();
    expect(places.region('atlantis')).toBeUndefined();
    expect(places.city('atlantis')).toBeUndefined();
    expect(places.regionsOf('atlantis')).toEqual([]);
    expect(places.citiesOf('atlantis')).toEqual([]);
    expect(places.findRegion('')).toEqual([]);
    expect(places.findCountry('   ')).toEqual([]);
  });
});

describe('normaliseName', () => {
  it('trims, strips inner spaces, converts 臺 and lower-cases Latin', () => {
    expect(normaliseName('  臺 北 ')).toBe('台北');
    expect(normaliseName('Osaka')).toBe('osaka');
    expect(normaliseName('Ho Chi　Minh\tCity')).toBe('hochiminhcity');
  });
});
