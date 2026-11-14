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
        { id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [], group: 'europe' },
        { id: 'b', nameZh: '乙國', nameEn: 'B', aliases: [], group: 'europe' },
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
  // A chunk (text between arrow-type separators, whitespace, 、 ， or ,) naming a connection is not a visit;
  // its slash-joined alternatives go with it.
  it.each([
    // Jetour QSB, day 1: Paris is only where the plane is changed
    ['香港 ~ 布宜諾斯艾利斯 ~ 途經巴黎轉機', ['布宜諾斯艾利斯'], []],
    // Jetour QPE, day 1: Rio, before a space in the same arrow segment, is kept
    ['香港 ~ 里約熱內盧 途經巴黎轉機', ['里約熱內盧'], []],
    // Travel Expert TXXF04R, day 1: both stations of the 中轉 drop (the bracket goes first, as always)
    ['香港西九龍站(乘高鐵)中轉深圳北/廣州南> 泉州> 洛伽寺', ['泉州'], ['洛伽寺']],
    // Travel Expert TXXF04R, day 4: 廈門 before the 中轉 chunk is kept
    ['廈門> 七彩環島路> 外觀廈門標誌性建築【雙子塔】> 廈門(乘高鐵) 中轉深圳北/廣州南 > 香港西九龍站', ['廈門'], ['七彩環島路']],
    // Travel Expert TGGK06R: 經廣州南中轉 is a chunk of its own
    ['深圳福田口岸集合 > (乘地鐵) 深圳北站 > (乘動車) 經廣州南中轉 > (乘動車) 廣西「百色」', ['深圳'], ['廣西「百色」']],
    ['大阪 → 轉乘新幹線 → 京都', ['大阪', '京都'], []],
    ['大阪 → 過境東京 → 京都', ['大阪', '京都'], []],
  ])('extractStops([%j])', (heading, expectedNames, expectedUnmatched) => {
    const r = extractStops([heading], places);
    expect(names(r)).toEqual(expectedNames);
    expect(r.unmatched).toEqual(expectedUnmatched);
  });

  it('keeps 韶關 on Travel Expert YASP03R: the day-1 chunk 轉乘高鐵前往韶關 drops, the day-3 station reads', () => {
    const r = extractStops([
      '深圳福田口岸集合→乘地鐵前往深圳北站→轉乘高鐵前往韶關(約1.5小時)→午餐【於高鐵自理】→轉乘當地旅遊大巴→前往【莽山五指峰景區】',
      '#同仁堂(購物店)→被稱為 “郴州版鳳凰古城”【裕後街】→晚餐特別安排',
      '酒店自助早餐→工業旅遊示範點【湖南白銀博覽館】→【萬華岩】(重本包門票)洞內燈光下鐘乳石形態各異→午餐【福城農家土雞宴】→前往韶關站乘坐高鐵返回深圳北→轉乘地鐵返回福田關口散團。結束愉快行程！',
    ], places, ['hongkong-hongkong-hongkong', 'china-guangdong-shenzhen']);
    expect(names(r)).toEqual(['郴州', '韶關']);
  });

  it('keeps a city a space away from the transit word (a known limit)', () => {
    // Jetour QSC and others write 途經巴黎 轉機 / 經巴黎 或 阿姆斯特丹 轉機: only the 轉機 chunk drops
    expect(names(extractStops(['香港 ~ 利馬 ~ 途經巴黎 轉機'], places))).toEqual(['利馬', '巴黎']);
    expect(names(extractStops(['聖地牙哥 ~ 經巴黎 或 阿姆斯特丹 轉機'], places))).toEqual(['聖地牙哥', '巴黎', '阿姆斯特丹']);
  });

  it('leaves a chunk without transit wording alone', () => {
    // Jetour QSB, day 2: Paris named plainly is still read (a known limit: flight connections named plainly)
    expect(names(extractStops(['巴黎 ~ 布宜諾斯艾利斯'], places))).toEqual(['巴黎', '布宜諾斯艾利斯']);
    expect(names(extractStops(['香港 ~ 巴黎 ~ 利馬'], places))).toEqual(['巴黎', '利馬']);
  });

  it('drops only the chunk with transit wording, not the whole heading', () => {
    // Jetour: the connection is the last segment of a day that visits Mexico City
    const r = extractStops(['墨西哥城 ~ 憲法廣場 ~ 總統府 ~ 香港 ~ 途經巴黎轉機'], places);
    expect(names(r)).toEqual(['墨西哥城']);
    expect(r.unmatched).toEqual(['憲法廣場', '總統府']);
  });
});

describe('extractStops drops a single foreign outlier with a collision name', () => {
  // 甲國 has four cities; 乙國 has 撞名城 (a known collision), 別名城 (one by its alias 撞名別稱) and 乙城 (not one).
  const index = buildPlacesIndex({
    countries: [
      { id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [], group: 'europe' },
      { id: 'b', nameZh: '乙國', nameEn: 'B', aliases: [], group: 'europe' },
      { id: 'c', nameZh: '丙國', nameEn: 'C', aliases: [], group: 'europe' },
    ],
    regions: [
      { id: 'a-r', countryId: 'a', nameZh: '甲區', nameEn: 'AR', aliases: [] },
      { id: 'b-r', countryId: 'b', nameZh: '乙區', nameEn: 'BR', aliases: [] },
      { id: 'c-r', countryId: 'c', nameZh: '丙區', nameEn: 'CR', aliases: [] },
    ],
    cities: [
      { id: 'a-r-1', regionId: 'a-r', nameZh: '甲一', nameEn: 'A1', aliases: [] },
      { id: 'a-r-2', regionId: 'a-r', nameZh: '甲二', nameEn: 'A2', aliases: [] },
      { id: 'a-r-3', regionId: 'a-r', nameZh: '甲三', nameEn: 'A3', aliases: [] },
      { id: 'a-r-4', regionId: 'a-r', nameZh: '甲四', nameEn: 'A4', aliases: [] },
      { id: 'b-r-x', regionId: 'b-r', nameZh: '撞名城', nameEn: 'BX', aliases: [] },
      { id: 'b-r-y', regionId: 'b-r', nameZh: '別名城', nameEn: 'BY', aliases: ['撞名別稱'] },
      { id: 'b-r-z', regionId: 'b-r', nameZh: '乙城', nameEn: 'BZ', aliases: [] },
      { id: 'c-r-1', regionId: 'c-r', nameZh: '丙一', nameEn: 'C1', aliases: [] },
    ],
    collisionNames: ['撞名城', '撞名別稱'],
  });
  const run = (heading: string) => extractStops([heading], index);

  it.each([
    // a lone stop on the list amid three or more stops of one other country, neither first nor last
    ['甲一 → 甲二 → 撞名城 → 甲三 → 甲四', ['甲一', '甲二', '甲三', '甲四'], ['撞名城']],
    ['甲一 → 撞名城 → 甲二 → 甲三', ['甲一', '甲二', '甲三'], ['撞名城']],                  // exactly three others
    ['甲一 → 甲二 → 別名城 → 甲三', ['甲一', '甲二', '甲三'], ['別名城']],                  // listed through an alias
    // a repeat made consecutive by the removal collapses, as with excluded cities
    ['甲一 → 甲二 → 撞名城 → 甲二 → 甲三', ['甲一', '甲二', '甲三'], ['撞名城']],
  ])('removes the outlier in %j', (heading, expectedNames, expectedUnmatched) => {
    const r = run(heading);
    expect(names(r, index)).toEqual(expectedNames);
    expect(r.unmatched).toEqual(expectedUnmatched);
  });

  it.each([
    ['甲一 → 甲二 → 乙城 → 甲三 → 甲四', ['甲一', '甲二', '乙城', '甲三', '甲四']],              // not on the list
    ['撞名城 → 甲一 → 甲二 → 甲三', ['撞名城', '甲一', '甲二', '甲三']],                      // the first stop
    ['甲一 → 甲二 → 甲三 → 撞名城', ['甲一', '甲二', '甲三', '撞名城']],                      // the last stop
    ['甲一 → 撞名城 → 甲二', ['甲一', '撞名城', '甲二']],                                      // fewer than three others
    ['甲一 → 甲二 → 撞名城 → 甲三 → 丙一 → 甲四', ['甲一', '甲二', '撞名城', '甲三', '丙一', '甲四']], // others in two countries
    ['甲一 → 撞名城 → 甲二 → 乙城 → 甲三', ['甲一', '撞名城', '甲二', '乙城', '甲三']],        // its country occurs twice
  ])('keeps the foreign stop in %j', (heading, expectedNames) => {
    const r = run(heading);
    expect(names(r, index)).toEqual(expectedNames);
    expect(r.unmatched).toEqual([]);
  });

  it('counts stops after exclusions', () => {
    const excluded = ['a-r-4'];
    // with 甲四 excluded only two other stops remain, so 撞名城 stays
    expect(names(extractStops(['甲四 → 甲一 → 撞名城 → 甲二'], index, excluded), index)).toEqual(['甲一', '撞名城', '甲二']);
    // and here, with 甲四 excluded, 撞名城 becomes the last stop, so it stays
    expect(names(extractStops(['甲一 → 甲二 → 甲三 → 撞名城 → 甲四'], index, excluded), index))
      .toEqual(['甲一', '甲二', '甲三', '撞名城']);
  });

  it('treats a missing collisionNames list as empty', () => {
    const { collisionNames: _ignored, ...withoutList } = index.data;
    expect(names(extractStops(['甲一 → 甲二 → 撞名城 → 甲三'], buildPlacesIndex(withoutList)), index))
      .toEqual(['甲一', '甲二', '撞名城', '甲三']);
  });

  it('keeps Kirkenes on a Lapland tour (headings from Jetour BNFB)', () => {
    const r = extractStops([
      '香港 ~ 羅凡尼米', '羅凡尼米 ~ 馴鹿園 ~ 聖誕老人村', '羅凡尼米 ~ 凱米 ~ 破冰船 ~ 雪地體驗365 ~ 羅凡尼米',
      '羅凡尼米 ~ 拉努阿 ~ 野生動物園 ~ 薩利色爾卡', '薩利色爾卡 ~ 哈士奇雪橇犬場 ~ 冰湖垂釣 ~ 極光之夜',
      '薩利色爾卡 ~ 基凱尼斯 ~ 365雪景酒店 ~ 帝王蟹之旅', '基凱尼斯 ~ 伊納里 ~ 薩米博物館 ~ 薩利色爾卡',
      '薩利色爾卡 ~ 伊瓦洛 ~ 赫爾辛基', '赫爾辛基 ~ 上午自由活動 ~ 聖殿廣場教堂 ~ 參議院廣場 ~ 香港', '香港',
    ], places);
    expect(names(r)).toEqual(['羅凡尼米', '凱米', '羅凡尼米', '拉努阿', '薩利色爾卡', '基凱尼斯', '伊納里', '薩利色爾卡', '伊瓦洛', '赫爾辛基']);
  });

  it('keeps Vaduz on a Swiss tour (headings from Jetour ESZZX)', () => {
    const r = extractStops([
      '香港 ~ 蘇黎世 ~ 蘇黎世大教堂 ~ 施圖斯 ~ 聖加倫', '聖加倫 ~ 聖加倫大教堂 ~ 華多茲 ~ 庫爾',
      '庫爾 ~ 乘坐冰河列車頭等艙 ~ 布里格 ~ 盧加柏', '琉森 ~ 沙夫豪森 ~ 萊茵河瀑布 ~ 施泰因小鎮 ~ 蘇黎世', '蘇黎世 ~ 香港',
    ], places);
    expect(names(r)).toEqual(['蘇黎世', '施圖斯', '聖加倫', '華多茲', '庫爾', '布里格', '盧加柏', '琉森', '沙夫豪森', '施泰因', '蘇黎世']);
  });

  it('keeps Tirano and the Vatican on otherwise one-country routes (headings from Jetour ESZDX, EINA)', () => {
    expect(names(extractStops(['香港 ~ 蘇黎世 ~ 聖加倫', '聖莫理茲 ~ 蓬特雷西納 ~ 伯連那快車 ~ 蒂拉諾 ~ 盧加諾', '盧加諾 ~ 蘇黎世'], places)))
      .toEqual(['蘇黎世', '聖加倫', '聖莫里茲', '蓬特雷西納', '蒂拉諾', '盧加諾', '蘇黎世']);
    expect(names(extractStops(['香港 ~ 拿坡里', '巴里 ~ 乘意大利高鐵至羅馬', '羅馬 ~ 鬥獸場、西班牙階梯 ~ 許願泉 ~ 梵蒂岡 ~ 聖彼得大教堂', '羅馬 ~ 全日自由活動 ~ 香港'], places)))
      .toEqual(['拿坡里', '巴里', '羅馬', '梵蒂岡', '羅馬']);
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

  it('does not read 艾佛德神學院 (a madrasa in Fes) as Erfoud (Jetour KMA, KMC)', () => {
    expect(names(extractStops(['費斯 ~ 古城區 ~ 艾佛德神學院 ~ 費斯皮革染坊 ~ 皮革專門店 ~ 北古城堡 ~ 下午自由閒逛'], places))).toEqual(['費斯']);
    // Erfoud itself still reads
    expect(names(extractStops(['費斯 ~ 伊夫蘭 ~ 艾佛德 ~ 撒哈拉沙漠'], places))).toEqual(['費斯', '伊夫蘭', '艾佛德']);
  });

  it('does not read 蘇州河 (Suzhou Creek, Shanghai) as Suzhou (Jetour TSSKQ, TSDQ)', () => {
    expect(names(extractStops(['香港 ~ 洛克·外灘源 ~ 漫步蘇州河畔賞玉蘭花', '上海 ~ 思南公館片區 ~ 無錫'], places))).toEqual(['上海', '無錫']);
    expect(names(extractStops(['無錫 ~ 蠡湖風景區 ~ 太湖珍珠館 ~ 紫砂博物館 ~ 上海 ~ 洛克·外灘源 ~ 蘇州河畔 ~ 黃河路美食街'], places)))
      .toEqual(['無錫', '上海']);
  });

  it('does not read the show 《廣州起義》 as a visit to Guangzhou (Travel Expert YASJ03R, YBDB03R)', () => {
    // a staged show at a theme park on a Shunde tour
    expect(names(extractStops(['酒店自助早餐→約10:30離開酒店→重本包門票暢玩 【廣東千古情景區】帶你一秒穿越至武術街、風情街、 椰風海韻街等多個大型場景街道，沉浸式體驗大型實景劇場《廣州起義》；5D全方位視覺盛宴《大地震》 等多個表演令你目不暇接→午餐【貴賓園區內自理】 →入住酒店→晚餐【酒店豐富自助晚餐】→自由活動。'], places))).toEqual([]);
    // a visit named on the same day still reads
    expect(names(extractStops(['重本包門票暢玩【廣東千古情景區】~帶你一秒穿越至武術街、風情街、椰風海韻街等多個大型場景街道，沉浸式體驗大型實景劇場《廣州起義》；5D全方位視覺盛宴《大地震》等多個表演令你目不暇接→午餐【園區內自理】→約16:30離開前往廣州→晚餐 【玫瑰豉油雞宴】→前往廣州中山紀念堂'], places))).toEqual(['廣州']);
  });

  // EGL's practice crawl (2026-11-13): places added, and names that matched a place they are not.
  it.each([
    // 沖繩 is a region and regions match only exactly; the island is a city too (as 濟州), so it is found inside a name
    [['香港 → 直航沖繩 → 沖繩MAIN PLACE購物城'], ['沖繩']],
    [['香港 → 峇里島 → 海神廟', '峇里島 → 烏布小鎮 → 烏布皇宮'], ['峇里島', '烏布']],
    [['香港 → 汶萊 → 清真寺', '汶萊 → 遊覽淡武隆市鎮'], ['斯里巴加灣', '淡武廊']],
    [['香港 → (航機)科倫坡(斯里蘭卡)', '科倫坡 → (車程約4小時)丹布勒', '(車程約3小時)康堤 → 佛牙寺'], ['科倫坡', '丹布勒', '康提']],
    [['秘景奧入瀨溪流 → 十和田湖美景 → 青森港展望台'], ['十和田', '青森']],                  // not 和田 (Hotan)
    [['蘇黎世 → 拉珀斯維爾(瑞士) → 蘇黎世'], ['蘇黎世', '拉珀斯維爾', '蘇黎世']],          // not 珀斯 (Perth)
    [['布達佩斯(匈牙利) → 班斯卡-比斯特里察(斯洛伐克)'], ['布達佩斯', '班斯卡比斯特里察']],
    [['清津峽 → 小千谷錦鯉之鄉 → 新潟伊勢丹萬代大道'], ['小千谷']],                         // 伊勢丹 is a store, not 伊勢
    [['洞爺湖美景 → 昭和新山 → 熊牧場'], ['洞爺湖']],                                      // 昭和新山 is not 新山 (Johor Bahru)
    [['香港 → 桃園機場 → 台北'], ['台北']],                                               // the airport is not a visit to 桃園
    [['聖地牙哥 → 卡薩布蘭卡山谷(葡萄園) → 聖地牙哥'], ['聖地牙哥']],                     // a Chilean valley, not Casablanca
    [['非斯 → 舊城觀光 → 麥地那市集 → 皮革染坊'], ['費斯']],                               // a medina, not Medina
    [['仁川 → 欣賞峽谷、大理石冰'], ['仁川']],                                             // marble, not Dali
    [['嘉義 → 台灣小京都「檜意森活村」'], ['嘉義']],
    [['茵特拉肯(瑞士) → 何維克大道‧自由購物'], ['茵特拉肯']],                               // Höheweg, not Vík
    [['布加勒斯特(羅馬尼亞) → 加勒市區觀光'], ['布加勒斯特', '加勒']],                    // the longer name wins
  ])('reads the EGL headings %j', (headings, expectedNames) => {
    expect(names(extractStops(headings, places))).toEqual(expectedNames);
  });
});

describe('extractStops with notPlaces', () => {
  // 松山 is a city; 松山湖 contains it but is not it.
  const index = buildPlacesIndex({
    countries: [{ id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [], group: 'europe' }],
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
