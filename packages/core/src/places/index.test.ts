import { describe, it, expect } from 'vitest';
import { places, buildPlacesIndex, normaliseName, groupCountries, COUNTRY_GROUPS } from './index';
import { extractFallbackStops, extractStops } from '../stops';
import { suggestRegions } from '../suggest';
import type { PlacesData } from './index';
import rawData from './data.json';
import { zhHansName } from './zh-hans';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Cities added to the provinces of tasks 37 and 40 later (task 48: Taste's practice crawl), left out of their lists. */
const ADDED_LATER = new Set(['china-central-xingguo', 'china-sichuan-maoxian', 'china-sichuan-lixian']);
const firstCitiesOf = (regionId: string) => places.citiesOf(regionId).filter(city => !ADDED_LATER.has(city.id));

/**
 * Regions whose cities keep the id prefix of the region they were split from, because tours already saved in the
 * database hold those city ids. A city added to one of these regions later takes the same prefix.
 * - Task 37 (2026-11-15): 華中 (`china-central`) became 湖北, 河南 and 江西.
 * - Task 40 (2026-11-15): 北京及華北, 上海及華東, 四川重慶, 東北三省 and 西北 became their provinces and municipalities;
 *   北京, 上海 and 四川 kept the group's id, so only the others are listed.
 */
const KEPT_CITY_ID_PREFIXES: Readonly<Record<string, string>> = {
  'china-hubei': 'china-central', 'china-henan': 'china-central', 'china-jiangxi': 'china-central',
  'china-tianjin': 'china-beijing', 'china-shanxi': 'china-beijing', 'china-hebei': 'china-beijing',
  'china-zhejiang': 'china-shanghai', 'china-jiangsu': 'china-shanghai', 'china-anhui': 'china-shanghai',
  'china-chongqing': 'china-sichuan',
  'china-heilongjiang': 'china-northeast', 'china-jilin': 'china-northeast', 'china-liaoning': 'china-northeast',
  'china-shaanxi': 'china-northwest', 'china-gansu': 'china-northwest', 'china-qinghai': 'china-northwest', 'china-ningxia': 'china-northwest',
};

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
    checkId(c.id, Object.hasOwn(KEPT_CITY_ID_PREFIXES, c.regionId) ? KEPT_CITY_ID_PREFIXES[c.regionId] : c.regionId);
    if (!regionIds.has(c.regionId)) problems.push(`city ${c.id} has unknown region ${c.regionId}`);
  }
  // An area region (task 40) holds no city and names regions of its own country that are not areas.
  const regionById = new Map(data.regions.map(r => [r.id, r]));
  for (const area of data.regions.filter(r => r.members !== undefined)) {
    if (data.cities.some(c => c.regionId === area.id)) problems.push(`area ${area.id} holds a city`);
    if (area.members!.length === 0) problems.push(`area ${area.id} has no member`);
    for (const id of area.members!) {
      const member = regionById.get(id);
      if (member === undefined || member.countryId !== area.countryId || member.members !== undefined) problems.push(`area ${area.id} has a bad member ${id}`);
    }
  }
  return problems;
}

describe('Simplified spellings in operator text (task 34)', () => {
  it('the shared index finds a city or region by the Simplified form of its name or alias', () => {
    expect(places.findCity('清远').map(c => c.id)).toEqual(['china-guangdong-qingyuan']);
    expect(places.findCity('揭阳').map(c => c.id)).toEqual(['china-guangdong-jieyang']);
    expect(places.findRegion('陕西').map(r => r.id)).toEqual(['china-shaanxi']);
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
    expect(route(['山西', '浙江', '遼寧', '中原古都'])).toEqual(['region:china-shanxi', 'region:china-zhejiang', 'region:china-liaoning', 'region:china-henan']);
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
    // Since task 40, 東北 read as north-east China is the area 東北, which adds no stop beside a city or province of it.
    expect(route(['黑龍江', '吉林', '長白山', '東北'])).toEqual(['region:china-heilongjiang', 'china-northeast-jilin', 'china-northeast-changbaishan']);
    expect(route(['长白山', '东北'])).toEqual(['china-northeast-changbaishan']);
    expect(route(['仙台', '東北'])).toEqual(['japan-tohoku-sendai', 'region:japan-tohoku']);
  });
  it('東北 is decided by the rest of the route, wherever it stands (fix round 2)', () => {
    expect(route(['東北', '吉林', '長白山'])).toEqual(['china-northeast-jilin', 'china-northeast-changbaishan']);
    const japan = extractStops(['東北', '仙台', '松島'], places);
    expect(japan.stops.map(s => s.cityId ?? `region:${s.regionId}`)).toEqual(['region:japan-tohoku', 'japan-tohoku-sendai', 'japan-tohoku-matsushima']);
    expect(japan.unmatched).toEqual([]);
    expect(extractFallbackStops('東北 長白山8天', 8, places).stops.map(s => s.regionId)).toEqual(['china-jilin']);
  });
});

describe('places and guards from Taste Travel\'s practice crawl (task 48)', () => {
  const route = (headings: string[]) => extractStops(headings, places).stops.map(s => s.cityId ?? `region:${s.regionId}`);
  it('reads the new towns where they are', () => {
    expect(route(['博羅', '惠陽', '斗門', '武岡縣', '興國'])).toEqual([
      'china-guangdong-boluo', 'china-guangdong-huiyang', 'china-guangdong-doumen', 'china-hunan-wugang', 'china-central-xingguo',
    ]);
    expect(route(['茂縣', '理縣'])).toEqual(['china-sichuan-maoxian', 'china-sichuan-lixian']);
    expect(route(['胡志明市 → 美奈 → 芽莊'])).toEqual(['vietnam-south-ho-chi-minh-city', 'vietnam-south-mui-ne', 'vietnam-central-nha-trang']);
    // 艾芙拉 is Évora, not Edfu (艾芙, an alias of 艾德夫); 平海古城 is in Huidong.
    expect(route(['里斯本 → 艾芙拉', '艾德夫'])).toEqual(['portugal-portugal-lisbon', 'portugal-portugal-evora', 'egypt-egypt-edfu']);
    expect(route(['平海古城'])).toEqual(['china-guangdong-huidong']);
    expect(route(['珠海斗門'])).toEqual(['china-guangdong-zhuhai']); // the earliest of two names of one length, as before
  });
  it('does not read a place name inside the longer words found in the crawl log', () => {
    const cases: [string, string[]][] = [
      ['漳州 → 羅馬建築', ['china-fujian-zhangzhou']], ['羅馬城牆', []], ['倫敦 → 羅馬浴場 → 羅馬帝國', ['uk-uk-london']], ['羅馬神殿', []],
      ['長門 → <雲林寺', ['japan-chugoku-nagato']], ['松江河 → 長白山', ['china-northeast-changbaishan']],
      ['大連 → 中山廣場', ['china-northeast-dalian']], ['蘭州 → 中山橋', ['china-northwest-lanzhou']], ['南京 → 中山陵', ['china-shanghai-nanjing']],
      ['青島 → 將會安排', ['china-shandong-qingdao']], ['桃園居', []], ['世外桃園', []], ['冬天童話', []], ['淡水堰塞湖', []],
      ['長春科爾寺', []], ['雅拉山口', []], ['丹尼斯廣場', []], ['焦作 → 雲台山', ['china-central-jiaozuo']], ['雲臺山', []], ['基尼斯紀錄', []],
      ['河內 → 胡志明陵 → 胡志明故居', ['vietnam-north-hanoi']], ['胡志明亭', []], ['文昌宮', []], ['雲頂天梯', []], ['漢堡雜錦', []],
      ['上海生煎', []], ['福州世祖', []], ['長泰山', []], ['高山蘭花', []], ['高山下午茶', []], 
      ['侗族香格里拉', []], ['上海的威尼斯', []], ['上海威尼斯', []], ['水上威尼斯', []], ['海上威尼斯', []], ['威尼斯泳道', []],
      ['威尼斯超長水道', []], ['海南杜拜', []], ['南島敦煌', []], ['海上桂林', []], ['桂林之山、杭州之水', []], ['高原九寨溝', []],
      ['團聚和順', []], ['昆明湖', []], ['蓬萊三島', []], ['黃山歸來', []], ['黃山之奇', []], ['張家界之險', []], ['最大連片', []],
      ['長沙炮台', []], ['湘南的鳳凰古城', []], ['和田園', []], ['東興國門', []], ['磐羊湖', []],
    ];
    for (const [heading, ids] of cases) expect(route([heading]), heading).toEqual(ids);
    // The likeness in the two forms Taste writes (fix round 1): PLB03's `「新豐」` reads the town; KYZ02's and KYZ03's
    // `【新豐】` is a bracketed note, dropped, so that chunk names nothing.
    expect(route(['深圳 → 廣東香格里拉「新豐」→ 午餐'])).toEqual(['china-guangdong-shenzhen', 'china-guangdong-xinfeng']);
    expect(route(['深圳 → 廣東香格里拉【新豐】 → 午餐'])).toEqual(['china-guangdong-shenzhen']);
  });
  it('興國 (Xingguo) is not a temple named 興國寺, in either script, nor a lone stop amid another country (fix round 1)', () => {
    expect(route(['贛州 → 興國'])).toEqual(['china-central-ganzhou', 'china-central-xingguo']);
    expect(route(['赣州 → 兴国'])).toEqual(['china-central-ganzhou', 'china-central-xingguo']);
    for (const heading of ['興國寺', '兴国寺', '東興國門', '东兴国门']) expect(route([heading]), heading).toEqual([]);
    expect(places.data.collisionNames).toContain('興國');
    expect(route(['東京', '日光', '興國', '箱根', '東京'])).toEqual(['japan-kanto-tokyo', 'japan-kanto-nikko', 'japan-kanto-hakone', 'japan-kanto-tokyo']);
  });
  it('新興國… (新興國際 a hotel, 新興國家 emerging countries) is not 興國; a visit to the county 新興 is unaffected (follow-up round)', () => {
    for (const heading of ['入住新興國際酒店', '新興國家', '入住新兴国际酒店']) expect(route([heading]), heading).toEqual([]);
    // 新興 (Xinxing, Yunfu) is not in the places data. Were it added, the guard would block only the phrase: the
    // county named on its own, or before another word, is still read.
    const xinxing = { id: 'china-guangdong-xinxing', regionId: 'china-guangdong', nameZh: '新興', nameEn: 'Xinxing', aliases: [] };
    const withXinxing = buildPlacesIndex({ ...places.data, cities: [...places.data.cities, xinxing] });
    const read = (heading: string) => extractStops([heading], withXinxing).stops.map(s => s.cityId);
    expect(read('新興 → 雲浮')).toEqual(['china-guangdong-xinxing', 'china-guangdong-yunfu']);
    expect(read('新興溫泉')).toEqual(['china-guangdong-xinxing']);
    expect(read('新興國際酒店')).toEqual([]);
  });
  it('the real places beside them stay: Rome, Venice, Dubai, Ho Chi Minh City, Guilin, Kunming, Zhongshan, Hamburg', () => {
    expect(route(['羅馬 → 威尼斯'])).toEqual(['italy-italy-rome', 'italy-italy-venice']);
    expect(route(['杜拜', '胡志明市', '桂林', '昆明', '中山', '漢堡'])).toEqual([
      'uae-uae-dubai', 'vietnam-south-ho-chi-minh-city', 'china-guangxi-guilin', 'china-yunnan-kunming', 'china-guangdong-zhongshan', 'germany-germany-hamburg',
    ]);
  });
  it('竹山 (Zhushan, Taiwan) alone amid a Chinese route is a collision name; a Taiwan tour keeps it', () => {
    expect(route(['開平', '湛江', '竹山', '北海', '湛江'])).toEqual(['china-guangdong-kaiping', 'china-guangdong-zhanjiang', 'china-guangxi-beihai', 'china-guangdong-zhanjiang']);
    expect(route(['台中', '竹山', '日月潭'])).toContain('taiwan-central-zhushan');
  });
});

describe('華中 is replaced by the provinces 湖北, 河南 and 江西 (task 37)', () => {
  const route = (headings: string[]) => extractStops(headings, places).stops.map(s => s.cityId ?? `region:${s.regionId}`);
  const PROVINCE_CITIES: Record<string, string[]> = {
    'china-hubei': ['武漢', '宜昌', '恩施', '武當山', '巴東', '仙桃', '荊州', '秭歸', '襄陽', '漢川', '神農架', '宣恩'],
    'china-henan': ['登封', '鄭州', '開封', '洛陽', '三門峽', '焦作', '新鄉', '欒川'],
    'china-jiangxi': ['贛州', '鷹潭', '南豐', '南昌', '景德鎮', '婺源', '九江', '上饒', '吉安', '宜春', '新餘', '上猶', '龍南', '井岡山'],
  };
  it('each province is a region of China named by itself', () => {
    expect(['china-hubei', 'china-henan', 'china-jiangxi'].map(id => [places.region(id)?.countryId, places.region(id)?.nameZh, places.region(id)?.nameEn]))
      .toEqual([['china', '湖北', 'Hubei'], ['china', '河南', 'Henan'], ['china', '江西', 'Jiangxi']]);
    expect(places.findRegion('湖北').map(r => r.id)).toEqual(['china-hubei']);
    expect(places.findRegion('河南').map(r => r.id)).toEqual(['china-henan']);
    expect(places.findRegion('江西').map(r => r.id)).toEqual(['china-jiangxi']);
  });
  it('each of the 34 cities of 華中 is in its own province, with its id unchanged', () => {
    for (const [regionId, names] of Object.entries(PROVINCE_CITIES)) {
      expect(firstCitiesOf(regionId).map(c => c.nameZh).sort(), regionId).toEqual([...names].sort());
      for (const city of places.citiesOf(regionId)) expect(city.id, city.nameZh).toMatch(/^china-central-/);
    }
    expect(places.city('china-central-wuhan')?.regionId).toBe('china-hubei');
    expect(places.city('china-central-jinggangshan')?.regionId).toBe('china-jiangxi');
  });
  it('華中 is gone: no region has its id or name', () => {
    expect(places.region('china-central')).toBeUndefined();
    expect(places.citiesOf('china-central')).toEqual([]);
    expect(places.findRegion('華中')).toEqual([]);
    expect(places.findRegion('华中')).toEqual([]);
    expect(route(['華中'])).toEqual([]);
  });
  it('中原古都 (the old capitals of the Central Plains: 鄭州, 開封, 洛陽) is 河南', () => {
    expect(route(['中原古都'])).toEqual(['region:china-henan']);
    expect(route(['江西', '湖北'])).toEqual(['region:china-jiangxi', 'region:china-hubei']);
  });
  it('a province name inside a longer word in the crawl logs is not the province', () => {
    expect(route(['杭州 ~ 西湖北山街'])).toEqual(['china-shanghai-hangzhou']); // 西湖 北山街 in Hangzhou, not 湖北
    expect(route(['西湖北山路'])).toEqual([]);
    expect(route(['湛江西站 ~ 香港'])).toEqual(['china-guangdong-zhanjiang']); // Zhanjiang West station, not 江西
    expect(route(['鄭州 ~ 河南博物院'])).toEqual(['china-central-zhengzhou']);
    expect(route(['武漢（湖北省博物館）'])).toEqual(['china-central-wuhan']);
  });
  it('the search bar offers the province for its name, its English name and its cities', () => {
    const first = (q: string) => suggestRegions(q, places)[0];
    expect(first('湖北')).toMatchObject({ destination: { countryId: 'china', regionId: 'china-hubei' }, label: '中國 → 湖北' });
    expect(first('武漢')).toMatchObject({ destination: { countryId: 'china', regionId: 'china-hubei' }, via: '武漢' });
    expect(first('Henan')?.destination).toEqual({ countryId: 'china', regionId: 'china-henan' });
    expect(first('景德镇')?.destination).toEqual({ countryId: 'china', regionId: 'china-jiangxi' });
  });
  it('the search bar offers the three provinces for 華中, which stays no place name for routes (review M6)', () => {
    for (const q of ['華中', '华中']) {
      expect(suggestRegions(q, places).slice(0, 3).map(s => s.label), q).toEqual(['中國 → 湖北', '中國 → 河南', '中國 → 江西']);
    }
    expect(places.findRegion('華中')).toEqual([]);
    expect(extractStops(['華中', '华中'], places).stops).toEqual([]);
  });
});

describe('the grouped Chinese regions become provinces and municipalities (task 40)', () => {
  const route = (headings: string[]) => extractStops(headings, places).stops.map(s => s.cityId ?? `region:${s.regionId}`);
  const fallback = (text: string, days = 8) => extractFallbackStops(text, days, places).stops.map(s => s.cityId ?? `region:${s.regionId}`);
  /** Each new region: its names and its cities (by nameZh), all with their old ids. */
  const PROVINCES: Record<string, { zh: string; en: string; cities: string[] }> = {
    'china-beijing': { zh: '北京', en: 'Beijing', cities: ['北京'] },
    'china-tianjin': { zh: '天津', en: 'Tianjin', cities: ['天津'] },
    'china-shanxi': { zh: '山西', en: 'Shanxi', cities: ['五台山', '大同', '平遙', '太原', '臨汾', '隰縣', '吉縣', '朔州', '靈石', '晉城', '運城', '汾陽', '忻州'] },
    'china-hebei': { zh: '河北', en: 'Hebei', cities: ['唐山'] },
    'china-shanghai': { zh: '上海', en: 'Shanghai', cities: ['上海'] },
    'china-zhejiang': {
      zh: '浙江', en: 'Zhejiang',
      cities: ['杭州', '湖州', '濮院', '寧波', '烏鎮', '安吉', '南潯', '紹興', '嘉興', '西塘', '台州', '臨海', '仙居', '溫州', '舟山', '建德', '鹽官', '德清', '千島湖', '普陀山', '奉化', '衢州', '桐鄉', '文成', '橫店', '金華'],
    },
    'china-jiangsu': { zh: '江蘇', en: 'Jiangsu', cities: ['蘇州', '南京', '無錫', '揚州', '鎮江', '常州', '同里', '周莊', '宜興', '昆山', '太倉', '溧陽', '常熟', '南通'] },
    'china-anhui': { zh: '安徽', en: 'Anhui', cities: ['黃山', '池州', '九華山', '屯溪', '合肥'] },
    'china-sichuan': {
      zh: '四川', en: 'Sichuan',
      cities: ['成都', '九寨溝', '峨眉山', '樂山', '松潘', '都江堰', '康定', '稻城', '丹巴', '綿陽', '亞丁', '黃龍', '平武', '宜賓', '馬爾康', '臥龍', '金川', '彭州', '四姑娘山', '雅安', '瀘定', '色達', '八美'],
    },
    'china-chongqing': { zh: '重慶', en: 'Chongqing', cities: ['重慶', '奉節', '忠縣', '豐都', '巫山', '大足', '涪陵', '萬州', '武隆', '南川', '彭水', '長江三峽'] },
    'china-heilongjiang': { zh: '黑龍江', en: 'Heilongjiang', cities: ['哈爾濱', '漠河', '北極村', '牡丹江', '雪鄉', '亞布力'] },
    'china-jilin': { zh: '吉林', en: 'Jilin', cities: ['長春', '吉林', '敦化', '長白山', '二道白河', '延吉', '圖們', '舒蘭'] },
    'china-liaoning': { zh: '遼寧', en: 'Liaoning', cities: ['瀋陽', '大連', '旅順', '丹東'] },
    'china-shaanxi': { zh: '陝西', en: 'Shaanxi', cities: ['西安', '渭南', '臨潼', '延安', '靖邊', '韓城', '壺口', '寶雞', '黃陵', '甘泉'] },
    'china-gansu': { zh: '甘肅', en: 'Gansu', cities: ['蘭州', '敦煌', '嘉峪關', '張掖', '武威', '天水', '瓜州'] },
    'china-qinghai': { zh: '青海', en: 'Qinghai', cities: ['西寧', '茶卡', '德令哈', '貴德', '大柴旦'] },
    'china-ningxia': { zh: '寧夏', en: 'Ningxia', cities: ['銀川', '中衛', '青銅峽', '平羅', '固原'] },
  };
  /** The region each new region's cities had before, which their ids still start with. */
  const OLD_PREFIX: Record<string, string> = {
    'china-beijing': 'china-beijing', 'china-tianjin': 'china-beijing', 'china-shanxi': 'china-beijing', 'china-hebei': 'china-beijing',
    'china-shanghai': 'china-shanghai', 'china-zhejiang': 'china-shanghai', 'china-jiangsu': 'china-shanghai', 'china-anhui': 'china-shanghai',
    'china-sichuan': 'china-sichuan', 'china-chongqing': 'china-sichuan',
    'china-heilongjiang': 'china-northeast', 'china-jilin': 'china-northeast', 'china-liaoning': 'china-northeast',
    'china-shaanxi': 'china-northwest', 'china-gansu': 'china-northwest', 'china-qinghai': 'china-northwest', 'china-ningxia': 'china-northwest',
  };

  it('each province and municipality is a region of China named by itself', () => {
    for (const [id, { zh, en }] of Object.entries(PROVINCES)) {
      expect([places.region(id)?.countryId, places.region(id)?.nameZh, places.region(id)?.nameEn], id).toEqual(['china', zh, en]);
      expect(places.findRegion(zh).map(r => r.id), zh).toEqual([id]);
    }
  });
  it('each of the 142 cities of the five old groups is in its own province, with its id unchanged', () => {
    for (const [id, { cities }] of Object.entries(PROVINCES)) {
      expect(firstCitiesOf(id).map(c => c.nameZh).sort(), id).toEqual([...cities].sort());
      for (const city of places.citiesOf(id)) expect(city.id, city.nameZh).toMatch(new RegExp(`^${OLD_PREFIX[id]}-`));
    }
    expect(Object.values(PROVINCES).flatMap(p => p.cities)).toHaveLength(142);
    expect(places.city('china-shanghai-hangzhou')?.regionId).toBe('china-zhejiang');
    expect(places.city('china-sichuan-three-gorges')?.regionId).toBe('china-chongqing');
  });
  it('a province name alone is the province; a Simplified one too, and 陝西 is not 山西 in either script', () => {
    expect(route(['山西', '浙江', '江蘇', '安徽', '四川', '黑龍江', '遼寧', '陝西', '甘肅', '青海', '寧夏', '河北'])).toEqual([
      'region:china-shanxi', 'region:china-zhejiang', 'region:china-jiangsu', 'region:china-anhui', 'region:china-sichuan',
      'region:china-heilongjiang', 'region:china-liaoning', 'region:china-shaanxi', 'region:china-gansu', 'region:china-qinghai',
      'region:china-ningxia', 'region:china-hebei',
    ]);
    expect(route(['陕西', '山西', '江苏', '黑龙江', '辽宁', '甘肃', '宁夏'])).toEqual([
      'region:china-shaanxi', 'region:china-shanxi', 'region:china-jiangsu', 'region:china-heilongjiang', 'region:china-liaoning',
      'region:china-gansu', 'region:china-ningxia',
    ]);
    expect(zhHansName('陝西')).toBe('陕西');
    expect(zhHansName('山西')).toBe('山西');
    expect(places.findRegion('陕西').map(r => r.id)).toEqual(['china-shaanxi']);
  });
  it('川西 is part of 四川', () => {
    expect(route(['川西'])).toEqual(['region:china-sichuan']);
    expect(route(['川西', '成都'])).toEqual(['region:china-sichuan', 'china-sichuan-chengdu']);
  });
  it('a municipality is the region and its one city: its name gives the city, never a second stop', () => {
    for (const [name, cityId] of [['北京', 'china-beijing-beijing'], ['天津', 'china-beijing-tianjin'], ['上海', 'china-shanghai-shanghai'], ['重慶', 'china-sichuan-chongqing']]) {
      expect(route([name]), name).toEqual([cityId]);
      expect(route([`${name} → ${name}`]), name).toEqual([cityId]);
    }
    expect(route(['北京', '天津'])).toEqual(['china-beijing-beijing', 'china-beijing-tianjin']);
    expect(route(['重庆'])).toEqual(['china-sichuan-chongqing']);
  });
  it('吉林 alone is still the city of 吉林, now in the province 吉林', () => {
    expect(route(['吉林'])).toEqual(['china-northeast-jilin']);
    expect(places.findCity('吉林').map(c => c.id)).toEqual(['china-northeast-jilin']);
    expect(places.findRegion('吉林').map(r => r.id)).toEqual(['china-jilin']);
    expect(places.city('china-northeast-jilin')?.regionId).toBe('china-jilin');
  });
  it('東北三省 and 西北 are gone as regions', () => {
    for (const id of ['china-northeast', 'china-northwest']) {
      expect(places.region(id), id).toBeUndefined();
      expect(places.citiesOf(id), id).toEqual([]);
    }
  });

  describe('group words', () => {
    it('華北, 西北, 大西北 and 川渝 name no place for a route', () => {
      for (const word of ['華北', '华北', '西北', '大西北', '川渝']) {
        expect(places.findRegion(word), word).toEqual([]);
        expect(route([word]), word).toEqual([]);
      }
      // The old region names are no names any more; read as text, they name the city inside them, as any word does.
      for (const word of ['北京及華北', '上海及華東', '四川重慶', '西北']) expect(places.findRegion(word), word).toEqual([]);
      expect(route(['北京及華北', '上海及華東', '四川重慶'])).toEqual(['china-beijing-beijing', 'china-shanghai-shanghai', 'china-sichuan-chongqing']);
      expect(route(['西北', '西安'])).toEqual(['china-northwest-xian']);
    });
    it('華東 alone is the area 華東, holding no city', () => {
      expect(route(['華東'])).toEqual(['region:china-area-east']);
      expect(route(['华东'])).toEqual(['region:china-area-east']);
      expect(places.region('china-area-east')).toMatchObject({ countryId: 'china', nameZh: '華東', nameEn: 'East China' });
      expect(places.citiesOf('china-area-east')).toEqual([]);
    });
    it('a group word adds no stop when the route has a city or a province of the group, wherever it stands', () => {
      expect(route(['華東', '上海', '杭州'])).toEqual(['china-shanghai-shanghai', 'china-shanghai-hangzhou']);
      expect(route(['杭州', '華東'])).toEqual(['china-shanghai-hangzhou']);
      expect(route(['華東', '浙江'])).toEqual(['region:china-zhejiang']);
      expect(route(['東北三省', '吉林'])).toEqual(['china-northeast-jilin']);
      expect(route(['中國東北', '遼寧'])).toEqual(['region:china-liaoning']);
      expect(fallback('東北 長白山8天')).toEqual(['china-northeast-changbaishan']);
    });
    it('a group word beside places of other groups only is the area', () => {
      expect(route(['廣州', '華東'])).toEqual(['china-guangdong-guangzhou', 'region:china-area-east']);
      expect(route(['北京', '東北'])).toEqual(['china-beijing-beijing', 'region:china-area-northeast']);
    });
    it('東北 beside a Liaoning city is north-east China and adds no stop; beside a Tohoku city it stays Tohoku', () => {
      expect(route(['瀋陽', '東北'])).toEqual(['china-northeast-shenyang']);
      expect(route(['東北', '大連'])).toEqual(['china-northeast-dalian']);
      expect(route(['仙台', '東北'])).toEqual(['japan-tohoku-sendai', 'region:japan-tohoku']);
      expect(route(['東北', '仙台'])).toEqual(['region:japan-tohoku', 'japan-tohoku-sendai']);
    });
    it('東北 alone is still read as Tohoku and flagged, as before', () => {
      const alone = extractStops(['東北'], places);
      expect(alone.stops.map(s => s.regionId)).toEqual(['japan-tohoku']);
      expect(alone.unmatched).toEqual(['東北']);
    });
    it('the area names 東北三省 and 中國東北 are names of the area 東北', () => {
      expect(places.findRegion('東北三省').map(r => r.id)).toEqual(['china-area-northeast']);
      expect(places.findRegion('中國東北').map(r => r.id)).toEqual(['china-area-northeast']);
      expect(places.findRegion('東北').map(r => r.id)).toEqual(['japan-tohoku', 'china-area-northeast']);
    });
  });

  it('a municipality\'s name inside a street, building, dish or phrase is not the city (guards)', () => {
    const cases: [string, string[]][] = [
      ['廣州 → 北京路步行街', ['china-guangdong-guangzhou']], // Guangzhou's shopping street
      ['北京道', []], ['北京填鴨晚餐', []], ['北京填鸭', []],
      ['大連 → 天津街', ['china-northeast-dalian']], // Dalian's shopping street
      ['品嚐上海菜', []], ['廣州 → 夜上海', ['china-guangdong-guangzhou']],
      ['拉薩 → 登上海拔五千米的山口', ['china-tibet-lhasa']], // 登上 海拔 ("climb to an altitude of"), not 上海
      ['重慶大廈', []], ['重庆大厦', []], ['重慶火鍋晚餐', []], ['重庆火锅', []],
    ];
    for (const [heading, ids] of cases) expect(route([heading]), heading).toEqual(ids);
    // The city itself still reads, beside a guarded phrase too.
    expect(route(['北京 → 北京填鴨'])).toEqual(['china-beijing-beijing']);
    expect(route(['重慶 ~ 洪崖洞 ~ 重慶火鍋'])).toEqual(['china-sichuan-chongqing']);
    expect(route(['上海外灘'])).toEqual(['china-shanghai-shanghai']);
    // No guard for 上海街 (fix round 1, review M1): "the streets of Shanghai" is ordinary travel copy.
    expect(route(['杭州 → 漫步上海街頭'])).toEqual(['china-shanghai-hangzhou', 'china-shanghai-shanghai']);
  });

  describe('the search bar', () => {
    const regionIds = (q: string) => suggestRegions(q, places, 20).map(s => s.destination.regionId);
    it('a group word offers its provinces, never an area row (fix round 1, review I1)', () => {
      expect(regionIds('華北').slice(0, 4)).toEqual(['china-beijing', 'china-tianjin', 'china-shanxi', 'china-hebei']);
      expect(regionIds('华北').slice(0, 4)).toEqual(['china-beijing', 'china-tianjin', 'china-shanxi', 'china-hebei']);
      for (const q of ['西北', '大西北']) {
        expect(regionIds(q).slice(0, 4), q).toEqual(['china-shaanxi', 'china-gansu', 'china-qinghai', 'china-ningxia']);
      }
      expect(regionIds('川渝').slice(0, 2)).toEqual(['china-sichuan', 'china-chongqing']);
      for (const q of ['華東', '华东']) {
        expect(regionIds(q).slice(0, 4), q).toEqual(['china-shanghai', 'china-zhejiang', 'china-jiangsu', 'china-anhui']);
      }
      expect(regionIds('東北')).toEqual(expect.arrayContaining(['japan-tohoku', 'china-heilongjiang', 'china-jilin', 'china-liaoning']));
      expect(regionIds('東北三省').slice(0, 3)).toEqual(['china-heilongjiang', 'china-jilin', 'china-liaoning']);
      for (const q of ['華東', '东北', '東北', '東北三省', '中國東北', '華', '東', 'East China', 'china', 'chin']) {
        expect(regionIds(q).filter(id => id?.startsWith('china-area-')), q).toEqual([]);
      }
    });
    it('the English names of the old groups find their provinces again (fix round 1, review M5)', () => {
      for (const q of ['North China', 'north china']) {
        expect(regionIds(q).slice(0, 4), q).toEqual(['china-beijing', 'china-tianjin', 'china-shanxi', 'china-hebei']);
      }
      for (const q of ['Northwest', 'Northwest China']) {
        expect(regionIds(q).slice(0, 4), q).toEqual(['china-shaanxi', 'china-gansu', 'china-qinghai', 'china-ningxia']);
      }
      expect(regionIds('East China').slice(0, 4)).toEqual(['china-shanghai', 'china-zhejiang', 'china-jiangsu', 'china-anhui']);
      expect(regionIds('Northeast China').slice(0, 3)).toEqual(['china-heilongjiang', 'china-jilin', 'china-liaoning']);
      // The country still comes first for "china".
      expect(suggestRegions('china', places)[0]?.label).toBe('中國 → 全部地區');
    });
    it('a province, a municipality and a city find their own region', () => {
      expect(suggestRegions('浙江', places)[0]).toMatchObject({ destination: { countryId: 'china', regionId: 'china-zhejiang' }, label: '中國 → 浙江' });
      expect(suggestRegions('杭州', places)[0]).toMatchObject({ destination: { regionId: 'china-zhejiang' }, via: '杭州' });
      expect(suggestRegions('北京', places)[0]).toMatchObject({ destination: { regionId: 'china-beijing' }, label: '中國 → 北京' });
      expect(suggestRegions('吉林', places).filter(s => s.destination.regionId === 'china-jilin')).toHaveLength(1);
      expect(suggestRegions('Shaanxi', places)[0]?.destination.regionId).toBe('china-shaanxi');
    });
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
    const area = { id: 'a-area', countryId: 'a', nameZh: '甲地', nameEn: 'Area', aliases: [], members: ['a-r'] };
    expect(consistencyProblems({ ...base, regions: [...base.regions, area] })).toEqual([]);
    expect(consistencyProblems({ ...base, regions: [...base.regions, { ...area, members: ['zz-r'] }] })).toContain('area a-area has a bad member zz-r');
    expect(consistencyProblems({ ...base, regions: [...base.regions, area], cities: [...base.cities, { ...base.cities[0], id: 'a-area-y', regionId: 'a-area' }] }))
      .toContain('area a-area holds a city');
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
  it('no notPlaces entry holds another place name than the one it blocks, except those reviewed (task 48 fix round 1)', () => {
    // A guard stops every city name lying wholly inside it. The name it is for is the city the phrase reads as without
    // the guard; any other country, region or city name inside it is listed here, reviewed, with what the guard blocks.
    // A place added to the data later whose name lies inside a guard (長泰 in 長泰山, 東興 in 東興國門) fails here.
    const reviewed: Record<string, { blocks: string; alsoHolds: string[] }> = {
      '羅馬尼亞': { blocks: '羅馬', alsoHolds: ['羅馬尼亞'] }, // the country itself
      '南普拉薩': { blocks: '普拉', alsoHolds: ['拉薩'] },
      '巴里拉灣': { blocks: '巴里', alsoHolds: ['里拉'] },
      '北海道': { blocks: '北海', alsoHolds: ['北海道'] }, // the region itself
      '突尼斯': { blocks: '尼斯', alsoHolds: ['突尼斯'] }, // the country itself
      '卡薩布蘭卡山谷': { blocks: '', alsoHolds: ['卡薩布蘭卡'] }, // covered by 卡薩布蘭卡山, which blocks it
      '中山南西': { blocks: '中山', alsoHolds: ['山南'] },
      '卡斯特羅馬諾': { blocks: '卡斯特羅', alsoHolds: ['羅馬'] },
      '加勒菲斯': { blocks: '加勒', alsoHolds: ['菲斯'] },
      '新北海賓館': { blocks: '新北', alsoHolds: ['北海'] }, // a hotel in Beihai: Beihai is named elsewhere on its tours
      '廣西江': { blocks: '西江千戶苗寨', alsoHolds: ['廣西'] },
      '广西江': { blocks: '西江千戶苗寨', alsoHolds: ['广西'] },
      '江西江': { blocks: '西江千戶苗寨', alsoHolds: ['江西'] },
      '廣東香格里拉': { blocks: '香格里拉', alsoHolds: ['廣東'] },
      '上海的威尼斯': { blocks: '威尼斯', alsoHolds: ['上海'] }, // Shanghai is named elsewhere on its tours
      '上海威尼斯': { blocks: '威尼斯', alsoHolds: ['上海'] },
      '海南杜拜': { blocks: '杜拜', alsoHolds: ['海南'] },
      '南島敦煌': { blocks: '敦煌', alsoHolds: ['南島'] },
    };
    const names = new Set([
      ...places.data.countries.flatMap(c => [c.nameZh, ...c.aliases]),
      ...[...places.data.regions, ...places.data.cities].flatMap(p => places.matchNames(p)),
    ].map(normaliseName).filter(name => [...name].length >= 2));
    const notPlaces = places.data.notPlaces ?? [];
    const found: typeof reviewed = {};
    for (const entry of notPlaces) {
      const key = normaliseName(entry);
      const without = { ...places, data: { ...places.data, notPlaces: notPlaces.filter(e => e !== entry) } };
      const blocked = extractStops([entry], without, []).stops.flatMap(s => (s.cityId !== null ? [places.city(s.cityId)!] : []));
      const blockedNames = blocked.flatMap(c => places.matchNames(c).map(normaliseName)).filter(name => key.includes(name));
      const alsoHolds = [...names].filter(name => key.includes(name) && !blockedNames.some(b => b.includes(name)));
      if (alsoHolds.length > 0) found[entry] = { blocks: blocked.map(c => c.nameZh).join('+'), alsoHolds: alsoHolds.sort() };
    }
    expect(found).toEqual(reviewed);
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
    'china-beijing': ['北京'], // task 40: 天津 is a region of its own
    'china-shanghai': ['上海'], // task 40: 杭州 is in 浙江, 蘇州 and 南京 in 江蘇
    'china-sichuan': ['成都', '九寨溝'], // task 40: 重慶 is a region of its own
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
    // and 西北, 華中, 貴州, 內蒙古 and 海南, added from the operator dry runs (Task 19); 華中 became 湖北, 河南 and
    // 江西 in task 37; in task 40 北京及華北, 上海及華東, 四川重慶, 東北三省 and 西北 became 17 provinces and municipalities
    // and the two areas 華東 and 東北.
    // korea: the 4 seed regions plus 忠清道 and 全羅道, added from EGL's practice crawl.
    expect(counts).toEqual({
      japan: 9, korea: 6, taiwan: 4, thailand: 3, china: 33, vietnam: 3,
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
