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

describe('extractStops drops transit', () => {
  // A heading segment (text between arrow-type separators) naming a connection is not a visit.
  it.each([
    // Jetour QSB, day 1: Paris is only where the plane is changed
    ['香港 ~ 布宜諾斯艾利斯 ~ 途經巴黎轉機', ['布宜諾斯艾利斯'], []],
    // Jetour QSB-type wording with a space before 轉機
    ['香港 ~ 利馬 ~ 途經巴黎 轉機', ['利馬'], []],
    // Jetour: both alternatives of the connection drop, spaces inside the segment notwithstanding
    ['聖地牙哥 ~ 經巴黎 或 阿姆斯特丹 轉機', ['聖地牙哥'], []],
    // Travel Expert TXXF04R, day 1: both stations of the 中轉 drop (the bracket goes first, as always)
    ['香港西九龍站(乘高鐵)中轉深圳北/廣州南> 泉州> 洛伽寺', ['泉州'], ['洛伽寺']],
    // Travel Expert: 經廣州南中轉 is a segment of its own
    ['深圳福田口岸集合 > (乘地鐵) 深圳北站 > (乘動車) 經廣州南中轉 > (乘動車) 廣西「百色」', ['深圳'], ['廣西「百色」']],
    ['大阪 → 轉乘新幹線 → 京都', ['大阪', '京都'], []],
    ['大阪 → 過境東京 → 京都', ['大阪', '京都'], []],
  ])('extractStops([%j])', (heading, expectedNames, expectedUnmatched) => {
    const r = extractStops([heading], places);
    expect(names(r)).toEqual(expectedNames);
    expect(r.unmatched).toEqual(expectedUnmatched);
  });

  it('leaves a segment without transit wording alone', () => {
    // Jetour QSB, day 2: Paris named plainly is still read
    expect(names(extractStops(['巴黎 ~ 布宜諾斯艾利斯'], places))).toEqual(['巴黎', '布宜諾斯艾利斯']);
    expect(names(extractStops(['香港 ~ 巴黎 ~ 利馬'], places))).toEqual(['巴黎', '利馬']);
  });

  it('drops only the segment with transit wording, not the whole heading', () => {
    // Jetour: the connection is the last segment of a day that visits Mexico City
    const r = extractStops(['墨西哥城 ~ 憲法廣場 ~ 總統府 ~ 香港 ~ 途經巴黎轉機'], places);
    expect(names(r)).toEqual(['墨西哥城']);
    expect(r.unmatched).toEqual(['憲法廣場', '總統府']);
  });
});

describe('extractStops drops a single foreign outlier', () => {
  it.each([
    // lone Korean stop amid three or more Japanese ones, neither first nor last: removed and reported
    [['大阪 → 京都 → 首爾 → 奈良 → 神戶'], ['大阪', '京都', '奈良', '神戶'], ['首爾']],
    [['大阪 → 首爾 → 京都 → 奈良'], ['大阪', '京都', '奈良'], ['首爾']],                   // exactly three others
    // a repeat made consecutive by the removal collapses, as with excluded cities
    [['大阪 → 京都 → 首爾 → 京都 → 奈良'], ['大阪', '京都', '奈良'], ['首爾']],
  ])('extractStops(%j)', (headings, expectedNames, expectedUnmatched) => {
    const r = extractStops(headings, places);
    expect(names(r)).toEqual(expectedNames);
    expect(r.unmatched).toEqual(expectedUnmatched);
  });

  it.each([
    [['首爾 → 大阪 → 京都 → 奈良'], ['首爾', '大阪', '京都', '奈良']],                     // the first stop
    [['大阪 → 京都 → 奈良 → 首爾'], ['大阪', '京都', '奈良', '首爾']],                     // the last stop
    [['大阪 → 首爾 → 京都'], ['大阪', '首爾', '京都']],                                     // fewer than three others
    [['大阪 → 京都 → 首爾 → 台北 → 台中'], ['大阪', '京都', '首爾', '台北', '台中']],       // others in two countries
    [['大阪 → 首爾 → 京都 → 首爾 → 奈良'], ['大阪', '首爾', '京都', '首爾', '奈良']],       // the country occurs twice
  ])('keeps the foreign stop in %j', (headings, expectedNames) => {
    const r = extractStops(headings, places);
    expect(names(r)).toEqual(expectedNames);
    expect(r.unmatched).toEqual([]);
  });

  it('counts stops after exclusions', () => {
    // Hong Kong is excluded, so Seoul is not the first stop here
    expect(names(extractStops(['香港 → 大阪 → 首爾 → 京都 → 奈良'], places))).toEqual(['大阪', '京都', '奈良']);
    // and with Hong Kong excluded only three stops remain: Seoul is the last one, so it stays
    expect(names(extractStops(['大阪 → 京都 → 首爾 → 香港'], places))).toEqual(['大阪', '京都', '首爾']);
  });

  it('removes 塔林 (the Shaolin Pagoda Forest) from a Henan tour (Travel Expert TZZA06R)', () => {
    const r = extractStops([
      '香港西九龍站 (乘高鐵，直車或中轉車) > 鄭州 > 如意湖漫步、外觀河南藝術中心',
      '鄭州 > 輝縣 > 太行聖境【回龍天界山】 (包環保車，回龍掛壁公路、雲峰畫廊360度觀太行、遠眺老爺頂) > 登封',
      '登封 > 少林寺 (包電瓶車+耳機)、塔林、觀看武術表演 > 嵩陽書院 > 洛陽',
      '洛陽 > 龍門石窟 (包往返電瓶車+耳機) > 十字老街 > 鄭州',
      '洛陽 > 開封府 > 清明上河園 > 鄭州',
      '鄭州 (乘高鐵，直車或中轉車) > 香港西九龍站',
    ], places);
    expect(names(r)).toEqual(['鄭州', '登封', '洛陽', '鄭州', '洛陽', '開封', '鄭州']);
    expect(r.unmatched).toContain('塔林');
    expect(r.stops.every(stop => stop.countryId === 'china')).toBe(true);
  });

  it('removes 黃金海岸 (a beach in Quanzhou) from a Fujian tour (Travel Expert TXXF04R)', () => {
    const r = extractStops([
      '香港西九龍站(乘高鐵)中轉深圳北/廣州南> 泉州> 洛伽寺> 黃金海岸> 永寧古城',
      '泉州> 晉江> 梧林古村落(包電瓶車)(羅馬式洋樓朝東樓、 西班牙風格僑批樓、碉樓槍樓、百年榕村德衛宅) > 蟳埔民俗文化村(安排做對非遺體驗“簪花”) > 洛陽橋> 泉州> 泉州南少林寺(觀賞《南少林武術表演》)',
      '泉州> 廈門> 園博苑(觀賞落羽彬) > 入住波特曼七星灣 酒店酒店> 下午自由活動(體驗以其獨特的法式風情和 海濱度假體驗而聞名的酒店+怡海小鎮)',
      '廈門> 山海健康步道臨海線，盼歸塔> 七彩環島路> 外觀廈門標誌性建築【雙子塔】> 廈門(乘高鐵) 中轉深圳北/廣州南 > 香港西九龍站',
    ], places);
    expect(names(r)).toEqual(['泉州', '晉江', '泉州', '廈門']);
    expect(r.unmatched).toContain('黃金海岸');
  });
});

describe('extractStops on crawled headings', () => {
  const ids = (r: StopsResult) => r.stops.map(s => s.cityId);

  it('reads 昆卡 as Cuenca, Ecuador on an Ecuador tour (Jetour QRDS1)', () => {
    const r = extractStops(['阿姆斯特丹 ~ 基多', '瓜亞基爾 ~ 昆卡市內觀光 ~ 巴拿馬帽工廠', '昆卡 ~ 埃爾坦博 ~ 里奧班巴'], places);
    expect(ids(r)).toEqual([
      'netherlands-netherlands-amsterdam', 'ecuador-ecuador-quito', 'ecuador-ecuador-guayaquil',
      'ecuador-ecuador-cuenca', 'ecuador-ecuador-riobamba',
    ]);
    expect(r.unmatched).not.toContain('昆卡');
  });

  it('reads 昆卡 as Cuenca, Spain on a Spain tour', () => {
    const r = extractStops(['馬德里 ~ 昆卡', '昆卡 ~ 瓦倫西亞'], places);
    expect(ids(r)).toEqual(['spain-spain-madrid', 'spain-spain-cuenca', 'spain-spain-valencia']);
    expect(r.unmatched).toEqual([]);
  });

  it.each([
    // the Charles Darwin Research Station (Galápagos) is not Darwin, Australia: Jetour QRCS1, QCG
    [['阿約拉港 ~ 達爾文研究中心'], ['阿約拉港'], ['達爾文研究中心']],
    [['加拉巴哥群島 ~ 查爾斯‧達爾文研究中心 ~ 普韋托阿約拉港'], ['加拉帕戈斯群島', '阿約拉港'], []],     // the 11-character token is too long to report
    // the Ring of Kerry is not Kaili, Guizhou: Jetour EWIB-1
    [['基拉尼 ~ 凱里之環 ~ 托克瀑布、貴婦觀景台等 ~ 科克 ~ 布拉尼城堡與花園'], ['基拉尼'],
      ['凱里之環', '托克瀑布', '貴婦觀景台等', '科克', '布拉尼城堡與花園']],
    // a beach in Gangneung is not Jiangmen, Guangdong: Jetour VGW
    [['烏竹軒賞紅葉 ~ 江陵元宇宙體驗館 ~ 江陵咖啡街 ~ 江門海邊 ~ 江陵中央市場'], ['江陵'], ['烏竹軒賞紅葉', '江門海邊']],
    // 郴州版鳳凰古城 ("Chenzhou's own Fenghuang") names Chenzhou, not Fenghuang: Travel Expert YASP03R
    [['#同仁堂(購物店)→被稱為 “郴州版鳳凰古城”【裕後街】→晚餐特別安排'], ['郴州'], ['#同仁堂', '被稱為']],
  ])('extractStops(%j)', (headings, expectedNames, expectedUnmatched) => {
    const r = extractStops(headings, places);
    expect(names(r)).toEqual(expectedNames);
    expect(r.unmatched).toEqual(expectedUnmatched);
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
