import { describe, it, expect } from 'vitest';
import { places, buildPlacesIndex, normaliseName, groupCountries, COUNTRY_GROUPS } from './index';
import { extractFallbackStops, extractStops } from '../stops';
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

describe('Simplified spellings in operator text (task 34)', () => {
  it('the shared index finds a city or region by the Simplified form of its name or alias', () => {
    expect(places.findCity('清远').map(c => c.id)).toEqual(['china-guangdong-qingyuan']);
    expect(places.findCity('揭阳').map(c => c.id)).toEqual(['china-guangdong-jieyang']);
    expect(places.findRegion('陕西').map(r => r.id)).toEqual(['china-northwest']);
    expect(places.findRegion('云南').map(r => r.id)).toEqual(['china-yunnan']);
  });
  it('reads Simplified names in day headings and inside longer words, as the Traditional ones', () => {
    expect(extractStops(['云南', '大理', '清远连州'], places).stops.map(s => s.cityId ?? s.regionId))
      .toEqual(['china-yunnan', 'china-yunnan-dali', 'china-guangdong-qingyuan']);
  });
  it('a Simplified form that is another place\'s Traditional name is not added (the Traditional name wins)', () => {
    const index = buildPlacesIndex({
      countries: [{ id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [], group: 'europe' }],
      regions: [{ id: 'a-r', countryId: 'a', nameZh: '甲區', nameEn: 'R', aliases: [] }],
      cities: [
        { id: 'a-r-one', regionId: 'a-r', nameZh: '後山', nameEn: 'One', aliases: [] },
        { id: 'a-r-two', regionId: 'a-r', nameZh: '后山', nameEn: 'Two', aliases: [] },
      ],
    }, { simplifiedNames: { 後山: '后山', 后山: '后山', 甲區: '甲区' } });
    expect(index.findCity('后山').map(c => c.id)).toEqual(['a-r-two']);
    expect(index.findRegion('甲区').map(r => r.id)).toEqual(['a-r']);
  });
  it('an index built without Simplified names matches only the names in its data', () => {
    const index = buildPlacesIndex(rawData as PlacesData);
    expect(index.findCity('清远')).toEqual([]);
    expect(index.findCity('清遠').map(c => c.id)).toEqual(['china-guangdong-qingyuan']);
  });
  it('countries are matched by their data names only', () => {
    expect(places.findCountry('韩国')).toEqual([]);
  });
});

describe('places added for Yummy and Sunflower (task 34)', () => {
  const route = (headings: string[]) => extractStops(headings, places).stops.map(s => s.cityId ?? `region:${s.regionId}`);
  it('reads the new towns, scenic areas and regions where they are', () => {
    expect(route(['長江三峽'])).toEqual(['china-sichuan-three-gorges']);
    expect(route(['井岡山'])).toEqual(['china-central-jinggangshan']); // not Okayama (岡山) inside it
    expect(route(['西江'])).toEqual(['china-guizhou-xijiang']);
    expect(route(['小七孔', '中國天眼'])).toEqual(['china-guizhou-libo', 'china-guizhou-pingtang']);
    expect(route(['普者黑', '響沙灣', '海花島'])).toEqual(['china-yunnan-qiubei', 'china-inner-mongolia-ordos', 'china-hainan-danzhou']);
    expect(route(['山西', '浙江', '遼寧', '中原古都'])).toEqual(['region:china-beijing', 'region:china-shanghai', 'region:china-northeast', 'region:china-central']);
    expect(route(['華川', '全州', '楊平', '內藏山', '昆池岩', '永宗島'])).toEqual([
      'korea-gangwon-hwacheon', 'korea-jeolla-jeonju', 'korea-seoul-yangpyeong', 'korea-jeolla-naejangsan', 'korea-seoul-gonjiam', 'korea-seoul-incheon',
    ]);
    expect(route(['富士', '潮汕', '佛岡'])).toEqual(['japan-chubu-mount-fuji', 'china-guangdong-shantou', 'china-guangdong-fogang']);
  });
  it('Mongolia is a country of its own with a group, and 內蒙古 stays Inner Mongolia', () => {
    expect(places.country('mongolia')?.group).toBe('south-central-asia');
    expect(route(['烏蘭巴托', '貝加爾湖'])).toEqual(['mongolia-mongolia-ulaanbaatar', 'russia-russia-lake-baikal']);
    expect(route(['蒙古'])).toEqual(['region:mongolia-mongolia']);
    expect(route(['內蒙古'])).toEqual(['region:china-inner-mongolia']);
  });
  it('does not read the new names inside the longer words found in the crawl logs', () => {
    expect(route(['橫欄西江花海'])).toEqual([]);           // Zhongshan's flower park, not Xijiang
    expect(route(['恩平韓屋村'])).toEqual([]);             // Seoul's Eunpyeong, not Enping
    expect(route(['LALAPORT富士見'])).toEqual([]);          // Fujimi, Saitama
    expect(route(['阿格拉比特儲水池'])).toEqual([]);       // the Aghlabid basins of Kairouan, not Agra
    expect(route(['泰山島熱帶果園'])).toEqual([]);          // in the Mekong delta, not Mount Tai
    expect(route(['巴馬臣芝士工房'])).toEqual([]);          // Parmesan, not Bama
    expect(route(['潮汕特產手信', '潮汕牛肉火鍋', '潮汕站'])).toEqual([]);
  });
  it('Altai is not Mount Tai (fix round 1)', () => {
    expect(route(['禾木 ~ 阿爾泰山脈高山冰雪風光 ~ 禾木村'])).toEqual(['china-xinjiang-hemu']);
    expect(route(['阿尔泰山脉'])).toEqual([]);
    expect(route(['阿勒泰山區'])).toEqual(['china-xinjiang-altay']);
    expect(route(['泰山'])).toEqual(['china-shandong-taian']);
  });
  it('does not read the short new names inside common phrases (fix round 1)', () => {
    expect(route(['恩平安排溫泉2天'])).toEqual(['china-guangdong-enping']); // the guard is 感恩平安, not 恩平安
    for (const heading of [
      '文成公主廟', '文成城堡', '彌勒佛', '弥勒佛', '彌勒大佛', '青松觀', '奧巴馬故居', '太平南路', '和平南路', '金華火腿', '金华火腿',
      '富士蘋果', '富士電視台', '吉安慶修院', '吉安鄉', '感恩平安夜', '非常德國', '九龍南', '廣西江山', '江西江南', '金秀賢拍攝地',
    ]) expect(route([heading]), heading).toEqual([]);
    expect(route(['越南 廣南省會安'])).toEqual(['vietnam-central-hoi-an']);
  });
  it('themed and look-alike names in day lines are not the places they borrow (fix round 2)', () => {
    const cases: [string, string[]][] = [
      ['瀋陽 → 「威尼斯水城」 → 大連', ['china-northeast-shenyang', 'china-northeast-dalian']],
      ['大連 → 夜遊臨江門大橋', ['china-northeast-dalian']],
      ['【威尼斯水城】以威尼斯城為藍本 → 「大連」墻', ['china-northeast-dalian']],
      ['湄南河源頭 → 彭世洛府', []],
      ['曼谷 → 泰國最大的淡水湖泊', ['thailand-bangkok-bangkok']],
      ['首爾 → 五台山國立公園', ['korea-seoul-seoul']],
      ['奈羅比 → 馬賽人村落 → 馬賽馬拉', ['kenya-kenya-nairobi', 'kenya-kenya-masai-mara']],
      ['馬賽族文化 → 馬賽傳統聚落', []],
      ['昆明 → 大理-理想邦·聖托里尼-大理古城', ['china-yunnan-kunming', 'china-yunnan-dali']],
      ['理想邦聖托里尼', []], ['大理聖托里尼', ['china-yunnan-dali']], ['雲南聖托里尼', []],
      ['溫哥華 ~ 基隆拿 ~ 水怪湖', ['canada-west-vancouver', 'canada-west-kelowna']],
      ['魯朗林海觀景臺 ~ 巨柏林', ['china-tibet-lulang']],
      ['若羌 ~ 米蘭古城遺址', []], ['“中國版棉花堡”【白水台】', []], ['巴黎式騎樓街', []],
      ['亞爾勒 ~ 羅馬圓形劇場', ['france-france-arles']], ['荷伯特 ~ 莎拉曼卡市集', ['australia-tasmania-hobart']],
      ['莎拉哥莎', []], ['庫庫爾康金字塔', []], ['阿達巴斯卡瀑布', []], ['伊努維克鎮', []], ['埃蒙頓', []],
      ['聖路加教堂', []], ['華沙號戰船博物館', []], ['波爾圖托雷斯', []], ['蓬蒂迪利馬', []], ['劍橋葡萄園', []],
      ['吉默瓦爾德', []], ['阿特施泰騰城堡', []], ['菲爾斯霍芬', []], ['莫斯科維茨', []], ['富國大世界-威尼斯河', []],
      ['雲頂觀景台', []], ['南昆山國家森林公園', []], ['船遊廣東小烏鎮', []], ['廣東版《麗江古城》', []],
      ['夜上海風情街', []], ['享有“桂林之山水”美譽', []], ['小烏來天空步道', []],
    ];
    for (const [heading, ids] of cases) expect(route([heading]), heading).toEqual(ids);
  });
  it('淡水老城 is Danshui in Huizhou; 淡水老街 and 淡水河 stay Tamsui', () => {
    expect(route(['淡水老城文化歷史街區'])).toEqual(['china-guangdong-danshui']);
    expect(route(['淡水老街'])).toEqual(['taiwan-north-tamsui']);
    expect(route(['橫渡淡水河'])).toEqual(['taiwan-north-tamsui']);
  });
  it('a lone 聖托里尼 amid a Chinese route is dropped as a collision name; a Greek tour keeps it', () => {
    expect(route(['昆明', '大理', '洱海 ~ 聖托里尼', '麗江', '昆明'])).toEqual(['china-yunnan-kunming', 'china-yunnan-dali', 'china-yunnan-lijiang', 'china-yunnan-kunming']);
    expect(route(['雅典', '米克諾斯', '聖托里尼', '雅典'])).toEqual(['greece-greece-athens', 'greece-greece-mykonos', 'greece-greece-santorini', 'greece-greece-athens']);
  });
  it('the short Korean and Chinese town names shared with other places are collision names', () => {
    expect(places.data.collisionNames).toEqual(expect.arrayContaining(['丹陽', '全州', '廣南', '吉安', '青松']));
  });
  it('潮汕 is another name for 汕頭, and a run of them collapses (fix round 1)', () => {
    expect(route(['潮汕'])).toEqual(['china-guangdong-shantou']);
    expect(route(['汕頭 → 古代潮汕遠洋地標 → 汕頭'])).toEqual(['china-guangdong-shantou']);
    expect(places.city('china-guangdong-chaoshan')).toBeUndefined();
  });
  it('東北 beside Chinese stops is north-east China; beside Japanese ones it stays Tohoku (fix round 1)', () => {
    expect(route(['黑龍江', '吉林', '長白山', '東北'])).toEqual(['region:china-northeast', 'china-northeast-jilin', 'china-northeast-changbaishan', 'region:china-northeast']);
    expect(route(['长白山', '东北'])).toEqual(['china-northeast-changbaishan', 'region:china-northeast']);
    expect(route(['仙台', '東北'])).toEqual(['japan-tohoku-sendai', 'region:japan-tohoku']);
  });
  it('東北 is decided by the rest of the route, wherever it stands (fix round 2)', () => {
    expect(route(['東北', '吉林', '長白山'])).toEqual(['region:china-northeast', 'china-northeast-jilin', 'china-northeast-changbaishan']);
    const japan = extractStops(['東北', '仙台', '松島'], places);
    expect(japan.stops.map(s => s.cityId ?? `region:${s.regionId}`)).toEqual(['region:japan-tohoku', 'japan-tohoku-sendai', 'japan-tohoku-matsushima']);
    expect(japan.unmatched).toEqual([]);
    expect(extractFallbackStops('東北 長白山8天', 8, places).stops.map(s => s.regionId)).toEqual(['china-northeast', 'china-northeast']);
  });
});

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
      countries: [{ id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [], group: 'europe' }, { id: 'b', nameZh: '乙國', nameEn: 'B', aliases: [], group: 'europe' }],
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
      countries: [{ id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [], group: 'europe' }],
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
  it('every notPlaces entry contains a city name and is not itself a city', () => {
    // An entry may be a country or region name (羅馬尼亞 contains 羅馬), never a city's own name. A city name here is
    // any the scraper matches, Simplified forms included (阿格拉比 contains 阿格拉, the mainland name of 亞格拉).
    const cityNames = places.data.cities.flatMap(c => places.matchNames(c)).map(normaliseName);
    const notPlaces = places.data.notPlaces ?? [];
    expect(notPlaces).toContain('松山湖');
    for (const entry of notPlaces) {
      const key = normaliseName(entry);
      expect(cityNames.some(name => key.includes(name)), entry).toBe(true);
      expect(places.findCity(entry), entry).toEqual([]);
    }
  });
  it('every notPlaces entry hides its own phrase: without it the phrase would read as a place (fix round 2)', () => {
    // 卡薩布蘭卡山谷 is covered by the shorter 卡薩布蘭卡山 (an older entry, kept as it was).
    const covered = ['卡薩布蘭卡山谷'];
    const key = (r: { stops: { cityId: string | null; regionId: string }[] }) => r.stops.map(s => s.cityId ?? s.regionId).join('>');
    const notPlaces = places.data.notPlaces ?? [];
    const idle = notPlaces.filter(entry => {
      // The shared index with this one entry left out of its notPlaces (extractStops reads them from index.data).
      const without = { ...places, data: { ...places.data, notPlaces: notPlaces.filter(e => e !== entry) } };
      return key(extractStops([entry], places)) === key(extractStops([entry], without));
    });
    expect(idle).toEqual(covered);
    // The guards added in task 34 (removing one fails here as well as in its own test).
    const task34 = [
      '清邁小鎮', '台山滋味', '正宗順德', '中山特色', '順德粥', '深圳往返', '阿格拉比', '西江花', '泰山島', '巴馬臣',
      '恩平韓屋', '潮汕特產', '潮汕牛肉', '潮汕站', '富士見', '阿爾泰山', '阿尔泰山', '文成公主', '文成城堡', '彌勒佛',
      '弥勒佛', '彌勒大佛', '弥勒大佛', '彌勒殿', '青松觀', '青松观', '廣南省', '广南省', '奧巴馬', '奥巴马',
      '太平南', '平南路', '金華火腿', '金华火腿', '富士蘋果', '富士苹果', '富士電視', '富士电视', '吉安慶修院', '吉安庆修院',
      '吉安鄉', '吉安乡', '感恩平安', '非常德', '九龍南', '九龙南', '廣西江', '广西江', '江西江', '金秀賢',
      '金秀贤', '威尼斯水城', '威尼斯河', '臨江門', '淡水湖', '五台山國立公園', '馬賽人', '馬賽族', '馬賽傳統', '理想邦·聖托里尼',
      '理想邦聖托里尼', '理聖托里尼', '南聖托里尼', '巨柏林', '米蘭古城', '版棉花堡', '巴黎式', '羅馬圓形', '莎拉曼卡', '莎拉哥莎',
      '庫庫爾康', '巴斯卡', '努維克', '埃蒙頓', '聖路加', '華沙號', '波爾圖托雷斯', '迪利馬', '劍橋葡萄園', '默瓦爾德',
      '特施泰騰', '斯霍芬', '莫斯科維茨', '雲頂觀景', '南昆山', '小烏鎮', '版《麗江古城', '上海風情街', '桂林之山', '小烏來',
      '威尼斯城為', '河源頭',
    ];
    expect(task34.filter(entry => !notPlaces.includes(entry))).toEqual([]);
  }, 30_000);
  it('every collisionNames entry is a city name or alias', () => {
    // 塔林 (Tallinn; the Shaolin Pagoda Forest, Travel Expert TZZA06R/TZZB08R) and 黃金海岸 (Gold Coast; a beach in Quanzhou, TXXF04R)
    const collisionNames = places.data.collisionNames ?? [];
    expect(collisionNames).toEqual(expect.arrayContaining(['塔林', '黃金海岸']));
    for (const entry of collisionNames) expect(places.findCity(entry), entry).not.toEqual([]);
  });
  it('no country or region name reads as a city elsewhere through a name it contains', () => {
    // e.g. 北海道 contains 北海 (Beihai) and 突尼斯 contains 尼斯 (Nice): a heading naming the
    // region or country must not put a city of another place on the route.
    const misread: string[] = [];
    const check = (name: string, owns: (cityRegionId: string, cityCountryId: string) => boolean) => {
      for (const stop of extractStops([name], places, []).stops) {
        if (stop.cityId !== null && !owns(stop.regionId, stop.countryId)) misread.push(`${name} → ${stop.cityId}`);
      }
    };
    for (const country of places.data.countries) {
      for (const name of [country.nameZh, ...country.aliases]) check(name, (_, countryId) => countryId === country.id);
    }
    for (const region of places.data.regions) {
      for (const name of [region.nameZh, ...region.aliases]) check(name, regionId => regionId === region.id);
    }
    expect(misread).toEqual([]);
  });
  it('every entry has a Chinese and an English name', () => {
    const all = [...places.data.countries, ...places.data.regions, ...places.data.cities];
    for (const p of all) {
      expect(p.nameZh, p.id).not.toBe('');
      expect(p.nameEn, p.id).not.toBe('');
    }
  });
});

/** Returns every country whose group is missing or not in COUNTRY_GROUPS; empty means every country has one. */
function groupProblems(data: { countries: { id: string; group?: unknown }[] }): string[] {
  const known = new Set<unknown>(COUNTRY_GROUPS.map(g => g.id));
  const problems: string[] = [];
  for (const c of data.countries) {
    if (c.group === undefined || c.group === '') problems.push(`${c.id} has no group`);
    else if (!known.has(c.group)) problems.push(`${c.id} has unknown group ${String(c.group)}`);
  }
  return problems;
}

describe('country groups', () => {
  const country = (id: string, group: string) => ({ id, nameZh: id, nameEn: id, aliases: [], group });

  it('lists the groups in display order with their labels', () => {
    expect(COUNTRY_GROUPS.map(g => [g.id, g.nameZh])).toEqual([
      ['china', '中國內地及港澳台'],
      ['northeast-asia', '日本及韓國'],
      ['southeast-asia', '東南亞'],
      ['south-central-asia', '南亞及中亞'],
      ['middle-east', '中東'],
      ['europe', '歐洲'],
      ['americas', '美洲'],
      ['africa', '非洲'],
      ['oceania', '大洋洲'],
      ['polar', '南北極'],
    ]);
  });

  it('every country in data.json has a group from the list', () => {
    expect(groupProblems(rawData)).toEqual([]);
  });

  it('the group check catches a missing, an empty and an unknown group', () => {
    expect(groupProblems({ countries: [country('a', 'europe')] })).toEqual([]);
    expect(groupProblems({ countries: [{ id: 'a' }] })).toEqual(['a has no group']);
    expect(groupProblems({ countries: [country('a', '')] })).toEqual(['a has no group']);
    expect(groupProblems({ countries: [country('a', 'atlantis')] })).toEqual(['a has unknown group atlantis']);
  });

  it('places.countryGroups holds every country once, in list order within each group, and no empty group', () => {
    const groups = places.countryGroups;
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g.countries.length, g.id).toBeGreaterThan(0);
    // Groups keep the display order; an empty one (南北極 while the data has no polar entry) is left out.
    const order = COUNTRY_GROUPS.map(g => g.id);
    const indexes = groups.map(g => order.indexOf(g.id));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    expect(indexes.every(i => i >= 0)).toBe(true);
    expect(groups.map(g => g.nameZh)).toEqual(groups.map(g => COUNTRY_GROUPS[order.indexOf(g.id)].nameZh));
    // Within a group, countries come in the order of the flat list (data order).
    for (const g of groups) {
      expect(g.countries.map(c => c.id), g.id).toEqual(places.data.countries.filter(c => c.group === g.id).map(c => c.id));
    }
    const all = groups.flatMap(g => g.countries.map(c => c.id));
    expect([...all].sort()).toEqual(places.data.countries.map(c => c.id).sort());
  });

  it('puts the countries the brief names in their groups', () => {
    const groupOf = (id: string) => places.country(id)?.group;
    const expected: Record<string, string> = {
      china: 'china', hongkong: 'china', macau: 'china', taiwan: 'china',
      japan: 'northeast-asia', korea: 'northeast-asia',
      thailand: 'southeast-asia', singapore: 'southeast-asia',
      bhutan: 'south-central-asia', uzbekistan: 'south-central-asia', kazakhstan: 'south-central-asia',
      turkey: 'middle-east', uae: 'middle-east', georgia: 'middle-east', armenia: 'middle-east', azerbaijan: 'middle-east',
      russia: 'europe', iceland: 'europe', 'faroe-islands': 'europe', uk: 'europe',
      usa: 'americas', cuba: 'americas', brazil: 'americas',
      egypt: 'africa', morocco: 'africa', 'south-africa': 'africa',
      australia: 'oceania', 'new-zealand': 'oceania',
    };
    for (const [id, group] of Object.entries(expected)) expect(groupOf(id), id).toBe(group);
  });

  it('groupCountries keeps the given order, groups in display order, and leaves out empty groups', () => {
    const list = [country('x', 'europe'), country('y', 'china'), country('z', 'europe')] as Parameters<typeof groupCountries>[0];
    expect(groupCountries(list).map(g => [g.id, g.countries.map(c => c.id)])).toEqual([
      ['china', ['y']],
      ['europe', ['x', 'z']],
    ]);
    expect(groupCountries([])).toEqual([]);
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
    // Only the seed countries: Task 19's dry runs added many more.
    const seedIds = ['japan', 'korea', 'taiwan', 'thailand', 'china', 'vietnam', 'singapore', 'malaysia', 'hongkong', 'macau'];
    const counts = Object.fromEntries(seedIds.map(id => [id, places.regionsOf(id).length]));
    // china: the 11 seed regions plus 東北三省, added for Jetour's Harbin tours (Task 15),
    // and 西北, 華中, 貴州, 內蒙古 and 海南, added from the operator dry runs (Task 19).
    // korea: the 4 seed regions plus 忠清道 and 全羅道, added from EGL's practice crawl.
    expect(counts).toEqual({
      japan: 9, korea: 6, taiwan: 4, thailand: 3, china: 17, vietnam: 3,
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
