import { describe, it, expect } from 'vitest';
import { extractFallbackStops, extractStops, places, buildPlacesIndex } from './index';
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
    // Travel Expert TGGK06R: 經廣州南中轉 is a chunk of its own (百色 is in the places list since the Big Line pass)
    ['深圳福田口岸集合 > (乘地鐵) 深圳北站 > (乘動車) 經廣州南中轉 > (乘動車) 廣西「百色」', ['深圳', '百色'], []],
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

  // Review of the EGL places pass: short new names found inside unrelated words (Jetour, Charming, Big Line headings).
  it.each([
    [['墨爾本 ~ 雅拉河谷 ~ 酒莊'], ['墨爾本']],                               // the Yarra Valley, not Yala (Sri Lanka)
    [['阿魯沙 ~ 萬雅拉湖國家公園'], ['阿魯沙']],                               // Lake Manyara
    [['麗江 ~ 玉龍雪山 ~ 雅拉雪山'], ['麗江']],
    [['首爾 ~ 樂天水族館'], ['首爾']],                                         // Lotte aquarium, not Tianshui
    [['騰衝 ~ 熱海景區'], ['騰衝']],                                           // the Rehai hot springs, not Atami
    [['騰衝熱海 ~ 和順'], ['騰衝', '和順']],                                  // equal lengths: the earlier name, 騰衝, wins
    [['成都 ~ 黃龍溪古鎮'], ['成都']],                                         // a water town near Chengdu, not Huanglong
    [['杭州 ~ 黃龍洞'], ['杭州']],
    [['寧波 ~ 天童寺'], ['寧波']],                                             // a Ningbo temple, not Tendo
    [['坎昆 ~ 加勒比海'], ['坎昆']],                                           // the Caribbean, not Galle
    [['新山口站 ~ 秋芳洞'], []],                                               // Shin-Yamaguchi, not Johor Bahru
    [['泉州 ~ 安平橋'], ['泉州']],                                             // a bridge in Jinjiang, not Anping (Tainan)
    [['香港 ~ 北角館'], []],                                                   // not Kakunodate
    [['中山 ~ 沙溪堡'], ['中山']],                                             // not Shaxi (Yunnan)
    [['卡加利 ~ 基隆那 ~ 甘露市'], ['卡加利', '基隆那', '甘露市']],             // Kelowna, not Keelung
  ])('does not read a new short name inside %j', (headings, expectedNames) => {
    expect(names(extractStops(headings, places))).toEqual(expectedNames);
  });

  // The Charming places pass (2026-11-14): guards for short names inside longer words, and the new short names.
  it.each([
    [['墨爾本 ~ 雅拉谷 ~ 酒莊'], ['墨爾本']],                                 // the Yarra Valley again, written 雅拉谷
    [['漠河 ~ 圓滿歸程'], ['漠河']],                                          // "a happy trip home", not Mangui
    [['北京 ~ 崇禮雲頂滑雪場'], ['北京']],                                     // a ski resort in Chongli
    [['新加坡 ~ 登上雲頂夢號'], ['新加坡']],                                   // the cruise ship Genting Dream
    [['吉隆坡 ~ 雲頂美景'], ['吉隆坡']],
    [['北京 ~ 古北水鎮 ~ 臥龍湖碼頭'], ['北京']],                              // a lake by Gubei Water Town, not Wolong
    [['成都 ~ 臥龍 ~ 四姑娘山'], ['成都', '臥龍', '四姑娘山']],                 // Wolong itself
    [['柏斯 ~ 巴塞爾頓碼頭'], ['珀斯']],                                       // Busselton Jetty, not Basel
    [['杭州 ~ 千島湖 ~ 黃山'], ['杭州', '千島湖', '黃山']],                     // Qiandao Lake
    [['蓬塔阿雷納斯 ~ 百內國家公園'], ['蓬塔阿雷納斯']],                         // not 雷納 (Reine), which is left out
    [['米蘭 ~ 斯卡利傑羅城堡 ~ 維羅納'], ['米蘭', '維羅納']],                    // not 卡利 (Cali), which is left out
    [['特洛依古城 ~ 以弗所古城'], ['特洛依', '以弗所']],
    [['波羅克瓦尼 ~ 梅西納 ~ 貝特布里奇'], ['波羅克瓦尼', '梅西納', '拜特布里奇']], // Musina (South Africa), not Messina
    [['里約熱內盧 ~ 聖瑪爾塔 ~ 森巴樓梯街'], ['里約熱內盧']],                  // a Rio favela, not Santa Marta (Colombia)
    [['香港 ~ 吉利馬札羅機場'], []],                                           // Kilimanjaro, not Lima
    [['聖地牙哥 ~ 卡薩布蘭卡山山谷 ~ 瓦爾帕萊索'], ['聖地牙哥', '瓦爾帕萊索']],    // Chile's Casablanca valley
    [['烏馬納克 ~ 格陵蘭的里維埃拉'], ['烏馬納克']],                            // "the Riviera", not Ella (Sri Lanka)
    [['羅馬 ~ 卡斯特羅馬諾名品暢貨中心'], ['羅馬']],                            // Castel Romano outlet, not Castro (Chile)
  ])('Charming pass: reads %j as %j', (headings, expectedNames) => {
    expect(names(extractStops(headings, places))).toEqual(expectedNames);
  });

  // The Big Line places pass (2026-11-14) and its review: short names inside longer words, and the new names.
  it.each([
    [['羅弗敦群島 ~ 納爾維克'], ['羅弗敦群島', '納爾維克']],                    // Narvik, not Vík (Iceland)
    [['那維克 ~ 那維克戰争博物館'], ['納爾維克']],                              // Big Line's spelling of Narvik
    [['荔波 ~ 觀臥龍潭'], ['荔波']],                                            // a pool at Libo, not Wolong
    [['喀納斯 ~ 臥龍灣'], ['喀納斯']],                                          // a bay at Kanas
    [['贛州 ~ 臥龍峽谷'], ['贛州']],
    [['漳州 ~ 出片率極佳·臥龍書院'], ['漳州']],
    [['樂山 ~ 臥龍 ~ 四姑娘山'], ['樂山', '臥龍', '四姑娘山']],                  // Wolong itself still matches
    [['昆明 ~ 普洱茶廠'], ['昆明']],                                            // tea, not Pu'er the city
    [['溫荷克 ~ 索蘇斯 ~ 紅沙漠'], ['溫荷克', '蘇雪威里']],                    // Sossusvlei, not Sousse
    [['黃山 ~ 100%入住山頂最新北海賓館 ~ 屯溪'], ['黃山', '屯溪']],               // a hotel, not New Taipei or Beihai
    [['凱里 ~ 高山流水等苗族最崇高代客禮儀 ~ 貴陽'], ['凱里', '貴陽']],           // an idiom, not Takayama
    [['河內 ~ 越南最高山峰'], ['河內']],
    [['高山小京都 ~ 高山宮川朝市'], ['高山']],                                  // Takayama itself still matches
    [['斯沃爾韋爾 ~ (車程約4小時)埃沃內斯機場 ~ (內陸機)奧斯陸'], ['斯沃爾韋爾', '奧斯陸']], // Evenes only as the airport
    [['奧斯陸 ~ 埃沃內斯 ~ 斯沃爾韋爾'], ['奧斯陸', '埃沃內斯', '斯沃爾韋爾']],    // Evenes as a stop stays
    [['波德戈里察 ~ 尼殊 ~ 貝爾格萊德'], ['波德戈里察', '尼什', '貝爾格萊德']],
    [['加勒菲斯綠地廣場 ~ 康提'], ['康提']],                                    // Galle Face Green (Colombo), not Galle or Fes
    [['馬六甲 ~ 聖保羅教堂'], ['馬六甲']],                                      // St Paul's, Malacca, not São Paulo
    [['伊瓜蘇 ~ 聖保羅 ~ 里約熱內盧'], ['伊瓜蘇', '聖保羅', '里約熱內盧']],
    [['安曼 ~ 伯特拉古城 ~ 瓦地倫'], ['安曼', '佩特拉', '瓦迪倫']],
  ])('Big Line pass: reads %j as %j', (headings, expectedNames) => {
    expect(names(extractStops(headings, places))).toEqual(expectedNames);
  });

  it('drops 高山 (Takayama) as a lone foreign stop on a Guizhou route, and reports it', () => {
    const r = extractStops(['都勻 ~ 荔波 ~ 凱里 ~ 高山 ~ 貴陽'], places);
    expect(names(r)).toEqual(['都勻', '荔波', '凱里', '貴陽']);
    expect(r.unmatched).toContain('高山');
  });

  it('drops 聖保羅 as a lone foreign stop on a France route (Saint-Paul-de-Vence), and reports it', () => {
    const r = extractStops(['巴黎 ~ 里昂 ~ 聖保羅 ~ 馬賽'], places);
    expect(names(r)).toEqual(['巴黎', '里昂', '馬賽']);
    expect(r.unmatched).toContain('聖保羅');
  });

  // The final review of the Charming round: guards for names read inside longer words, and Charming's Jordan spellings.
  it.each([
    [['新加坡 ~ 馬哈馬里安曼印度廟'], ['新加坡']],                              // a Hindu temple, not Amman
    [['曼谷 ~ 參觀眾多佛像'], ['曼谷']],                                       // "many Buddhas", not Dover
    [['北京 ~ 利瑪竇墓'], ['北京']],                                           // Matteo Ricci's tomb, not Lima
    [['安曼 ~ 馬賽克之城 ~ 佩特拉'], ['安曼', '佩特拉']],                         // "the city of mosaics", not Marseille
    [['安曼 ~ 美底巴「馬賽克之城」 ~ 佩特拉'], ['安曼', '馬達巴', '佩特拉']],       // Madaba, as Charming spells it
    [['亞卡巴 ~ 哲拉希'], ['亞喀巴', '傑拉什']],                                // Aqaba and Jerash, Charming's spellings
    [['都柏林 ~ 恩尼斯科西'], ['都柏林']],                                      // Enniscorthy, not Nice
    [['倫敦 ~ 米爾頓凱恩斯'], ['倫敦']],                                        // Milton Keynes, not Cairns
    [['伊爾庫茨克 ~ 尤里加加林大街'], ['伊爾庫茨克']],                          // Yuri Gagarin Street, not Riga
    [['那維克 ~ 比約克利登 ~ 羅凡尼米'], ['納爾維克', '羅凡尼米']],                  // Björkliden, not York
    [['吉隆坡 ~ 香格里拉下午茶'], ['吉隆坡']],                                  // afternoon tea at the hotel, not Shangri-La
  ])('final review: reads %j as %j', (headings, expectedNames) => {
    expect(names(extractStops(headings, places))).toEqual(expectedNames);
  });

  it('drops 千島湖 on a Canada route as a lone foreign stop (the Thousand Islands), and reports it', () => {
    const r = extractStops(['多倫多 ~ 千島湖遊船 ~ 渥太華 ~ 滿地可 ~ 魁北克'], places);
    expect(names(r)).toEqual(['多倫多', '渥太華', '滿地可', '魁北克']);
    expect(r.unmatched).toContain('千島湖');
  });

  it('reports 多哈 (Doha) as unmatched: every EGL mention is a flight connection, so Qatar is not in the list', () => {
    const r = extractStops(['香港 ~ 多哈 ~ 里斯本'], places);
    expect(names(r)).toEqual(['里斯本']);
    expect(r.unmatched).toEqual(['多哈']);
  });

  it('reads 安順 with no country context as Anshun, Guizhou, and as Teluk Intan on a Malaysia route', () => {
    expect(ids(extractStops(['安順'], places))).toEqual(['china-guizhou-anshun']);
    expect(ids(extractStops(['貴陽 ~ 安順 ~ 黃果樹'], places))).toEqual(['china-guizhou-guiyang', 'china-guizhou-anshun', 'china-guizhou-huangguoshu']);
    expect(ids(extractStops(['吉隆坡 ~ 安順 ~ 怡保'], places)))
      .toEqual(['malaysia-peninsular-kuala-lumpur', 'malaysia-peninsular-teluk-intan', 'malaysia-peninsular-ipoh']);
  });
});

describe('Songdo: Incheon\'s and Busan\'s', () => {
  it('reads Incheon\'s Songdo (its central park, its hanok village) as Incheon, in headings and titles', () => {
    expect(extractStops(['仁川機場/ 乘坐松島公園水上的士/ 韓國傳統村落【松島韓屋村】 → 首爾'], places).stops.map(s => s.cityId))
      .toEqual(['korea-seoul-incheon', 'korea-seoul-seoul']);
    expect(extractStops(['首爾 → 松島中央公園'], places).stops.map(s => s.cityId)).toEqual(['korea-seoul-seoul', 'korea-seoul-incheon']);
    expect(extractFallbackStops('仁川首爾 水原5天 松島公園 松島韓屋村', 5, places).stops.map(s => s.cityId))
      .toEqual(['korea-seoul-incheon', 'korea-seoul-suwon', 'korea-seoul-incheon']);
  });
  it('still reads Busan\'s Songdo as Busan\'s', () => {
    for (const heading of ['釜山 → 松島天空步道', '釜山 → 松島海水浴場', '釜山 → 松島']) {
      expect(extractStops([heading], places).stops.map(s => s.cityId), heading).toContain('korea-busan-songdo');
    }
  });
});

describe('notPlaces guards found in title routes (task 34)', () => {
  it('清邁小鎮 is a themed stop near Pattaya, not Chiang Mai', () => {
    expect(names(extractStops(['曼谷 芭堤雅 清邁小鎮'], places))).toEqual(['曼谷', '芭堤雅']);
    expect(names(extractStops(['清邁 古城'], places))).toEqual(['清邁']);
  });
  it('深圳往返 is where a long-haul tour flies from, not a stop', () => {
    expect(extractFallbackStops('中亞兩國8天 深圳往返', 8, places).stops).toEqual([]);
  });
  it('a dish named for a town is not a visit to it (台山滋味, 正宗順德, 中山特色)', () => {
    expect(extractFallbackStops('台山滋味鵝宴 新會酒店2天', 2, places).stops.map(s => s.cityId)).toEqual(['china-guangdong-xinhui']);
    expect(extractFallbackStops('正宗順德私房菜 中山特色魚 珠海酒店2天', 2, places).stops.map(s => s.cityId)).toEqual(['china-guangdong-zhuhai']);
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

describe('extractFallbackStops (a route read from a title, owner request 2026-11-14)', () => {
  const read = (text: string, days = 8) => {
    const r = extractFallbackStops(text, days, places);
    return { names: r.stops.map(s => (s.cityId !== null ? places.city(s.cityId)!.nameZh : places.region(s.regionId)!.nameZh)), dropped: r.dropped };
  };

  describe('comparisons are not places', () => {
    it('小X: a small likeness of a place', () => {
      expect(read('廣東小香格里拉溫泉')).toEqual({ names: [], dropped: [{ name: '香格里拉', rule: 'comparison' }] });
    });
    it('no shorter name inside a passed-over comparison is read either (小香格里拉 is not 里拉)', () => {
      expect(read('小香格里拉').names).toEqual([]);
      expect(extractStops(['香格里拉'], places).stops).toHaveLength(1);
    });
    it('東方X', () => {
      expect(read('東方威尼斯水鄉')).toEqual({ names: [], dropped: [{ name: '威尼斯', rule: 'comparison' }] });
    });
    it('版X', () => {
      expect(read('廣東版麗江古城')).toEqual({ names: [], dropped: [{ name: '麗江', rule: 'comparison' }] });
    });
    it('a prefix marker sees through opening quote marks (版“X”, 小《X》)', () => {
      expect(read('廣東版“麗江古城”').names).toEqual([]);
      expect(read('廣東小《香格里拉》').names).toEqual([]);
    });
    it('版X only after a place name: an edition word before 版 leaves the place a stop', () => {
      expect(read('豪華版大阪6天', 6)).toEqual({ names: ['大阪'], dropped: [] });
      expect(read('精華版廣州2天', 2)).toEqual({ names: ['廣州'], dropped: [] });
      expect(read('升級版桂林 陽朔', 5)).toEqual({ names: ['桂林', '陽朔'], dropped: [] });
      expect(read('日本版威尼斯')).toEqual({ names: [], dropped: [{ name: '威尼斯', rule: 'comparison' }] });
      expect(read('中山版“小阿勒泰”').names).toEqual(['中山']);
    });
    it('X版 is read as a place: X is where the tour goes, what follows the likeness (陽朔版“千裡江山圖”)', () => {
      expect(read('京都版清明上河圖').names).toEqual(['京都']);
    });
    it('X風格', () => {
      expect(read('巴黎風格酒店')).toEqual({ names: [], dropped: [{ name: '巴黎', rule: 'comparison' }] });
    });
    it('X式', () => {
      expect(read('東京式拉麵')).toEqual({ names: [], dropped: [{ name: '東京', rule: 'comparison' }] });
    });
    it('the next place in the same words is read instead', () => {
      expect(read('享受峇里式溫泉中山度假村')).toEqual({ names: ['中山'], dropped: [{ name: '峇里島', rule: 'comparison' }] });
    });
    it('only the attached mention is passed over: the same place named on its own is a stop', () => {
      expect(read('峇里式按摩 峇里島')).toEqual({ names: ['峇里島'], dropped: [] });
    });
    it('X風情 is read as a place: it can be the place itself (感受夜廣州風情 on a Guangzhou tour)', () => {
      expect(read('感受夜京都風情').names).toEqual(['京都']);
    });
    it('X風 is read as a place: 風景 is scenery (丹霞山風景區)', () => {
      expect(read('丹霞山風景區').names).toEqual(['丹霞山']);
    });
    it('a listed place whose name begins with a marker is read whole (小欖, 小樽)', () => {
      expect(read('小欖菊展').names).toEqual(['小欖']);
      expect(read('小樽運河').names).toEqual(['小樽']);
    });
    it('day headings are read as before: the rule is for fallback text only', () => {
      expect(names(extractStops(['廣東小香格里拉'], places))).toEqual(['香格里拉']);
    });
  });

  describe('airlines are not places (rule 4)', () => {
    it('X航空: the airline is passed over and the next place in the same words is read', () => {
      expect(read('乘澳門航空直飛廈門')).toEqual({ names: ['廈門'], dropped: [{ name: '澳門', rule: 'airline' }] });
    });
    it('X航空公司', () => {
      expect(read('廈門航空公司 東京5天')).toEqual({ names: ['東京'], dropped: [{ name: '廈門', rule: 'airline' }] });
    });
    it('X航 at the end of its words (the short form)', () => {
      expect(read('廈門航 東京5天')).toEqual({ names: ['東京'], dropped: [{ name: '廈門', rule: 'airline' }] });
    });
    it('a region name or the excluded Hong Kong before 航空 gives no stop either', () => {
      expect(read('四川航空 東京5天')).toEqual({ names: ['東京'], dropped: [] });
      expect(read('海南航空 東京5天')).toEqual({ names: ['東京'], dropped: [] });
      expect(read('香港航空 東京5天')).toEqual({ names: ['東京'], dropped: [] });
    });
    it('only the attached mention is passed over: the same place on its own is a stop', () => {
      expect(read('廈門航空 廈門5天')).toEqual({ names: ['廈門'], dropped: [] });
    });
    it('航 followed by anything but 空 inside the words is not an airline (珠海航展 is in Zhuhai)', () => {
      expect(read('珠海航展2天', 2)).toEqual({ names: ['珠海'], dropped: [] });
      expect(read('廈門航班直飛', 5).names).toEqual(['廈門']);
    });
    it('day headings are read as before: the rule is for fallback text only', () => {
      expect(names(extractStops(['乘澳門航空'], places))).toEqual(['澳門']);
    });
  });

  describe('too far for the trip', () => {
    it('drops a stop outside the short-trip regions on a tour of at most 3 days', () => {
      expect(read('高山賞紅葉 中山', 3)).toEqual({ names: ['中山'], dropped: [{ name: '高山', rule: 'too-far' }] });
      expect(read('高山賞紅葉', 1)).toEqual({ names: [], dropped: [{ name: '高山', rule: 'too-far' }] });
    });
    it('drops a Korean stop on a short trip that also has a China-group stop (a word, not a flight)', () => {
      expect(read('中山溫泉 首爾炸雞', 3)).toEqual({ names: ['中山'], dropped: [{ name: '首爾', rule: 'too-far' }] });
      expect(read('澳門 釜山魚餅2天', 2)).toEqual({ names: ['澳門'], dropped: [{ name: '釜山', rule: 'too-far' }] });
    });
    it('keeps Seoul and Busan on a short trip with no China-group stop', () => {
      expect(read('首爾 水原3天', 3)).toEqual({ names: ['首爾', '水原'], dropped: [] });
      expect(read('釜山 慶州3天', 3)).toEqual({ names: ['釜山', '慶州'], dropped: [] });
    });
    it('keeps a Korean stop beside a China-group one on a longer tour', () => {
      expect(read('中山 首爾', 4).names).toEqual(['中山', '首爾']);
    });
    it('keeps it on a tour of 4 days or more', () => {
      expect(read('高山賞紅葉', 4)).toEqual({ names: ['高山'], dropped: [] });
    });
    it('keeps the short-trip regions: Guangdong, Guangxi, Hunan, Fujian, Jiangxi, Macau, Seoul, Busan', () => {
      for (const place of ['中山', '桂林', '郴州', '廈門', '澳門', '首爾', '釜山']) expect(read(`${place}2天`, 2)).toEqual({ names: [place], dropped: [] });
      expect(read('江西', 3)).toEqual({ names: ['華中'], dropped: [] }); // a region-only stop
    });
  });

  describe('a lone foreign stop', () => {
    it('drops the one place alone in its country when another country has two or more', () => {
      expect(read('雲南 麗江 大理 聖托里尼')).toEqual({ names: ['雲南', '麗江', '大理'], dropped: [{ name: '聖托里尼', rule: 'lone-country' }] });
    });
    it('keeps one place in each of two countries', () => {
      expect(read('首爾 東京').names).toEqual(['首爾', '東京']);
    });
    it('counts a place once however often the route returns to it', () => {
      expect(read('杜拜 斯里巴加灣 杜拜').names).toEqual(['杜拜', '斯里巴加灣', '杜拜']);
    });
    it('drops none when two or more countries have one place each', () => {
      expect(read('巴黎 尼斯 羅馬 蘇黎世').names).toEqual(['巴黎', '尼斯', '羅馬', '蘇黎世']);
    });
    it('counts mainland China, Macau and Taiwan as one country', () => {
      expect(read('澳門 珠海 中山').names).toEqual(['澳門', '珠海', '中山']);
      expect(read('廈門 泉州 台北').names).toEqual(['廈門', '泉州', '台北']);
    });
  });

  it('applies the rules in order: comparisons, too far, then a lone foreign stop', () => {
    // 高山 would also be a lone foreign stop beside two Guangdong places; on 3 days it is too far first.
    expect(read('珠海 中山 高山', 3).dropped).toEqual([{ name: '高山', rule: 'too-far' }]);
    expect(read('珠海 中山 高山', 8).dropped).toEqual([{ name: '高山', rule: 'lone-country' }]);
    // once 香格里拉 is a comparison, 高山 is alone with no country of two places: it stays on a long tour
    expect(read('小香格里拉 中山 高山', 8)).toEqual({ names: ['中山', '高山'], dropped: [{ name: '香格里拉', rule: 'comparison' }] });
  });

  it('passes over an excluded city inside a run of text, so the place after it is read (香港直航#廣西南寧)', () => {
    expect(read('香港直航#廣西南寧 6天')).toEqual({ names: ['南寧'], dropped: [] });
    expect(extractFallbackStops('深圳灣口岸東莞2天', 2, places, ['hongkong-hongkong-hongkong', 'china-guangdong-shenzhen']).stops.map(s => s.cityId))
      .toEqual(['china-guangdong-dongguan']);
  });
  it('a dish named for a town after the passed-over city is still not a stop (順德粥)', () => {
    expect(extractFallbackStops('深圳招牌順德粥底火鍋2天', 2, places, ['hongkong-hongkong-hongkong', 'china-guangdong-shenzhen']).stops).toEqual([]);
  });
  it('day headings keep reading the earliest city of a run of text, excluded or not (unchanged)', () => {
    expect(names(extractStops(['香港直航#廣西南寧'], places))).toEqual([]);
  });

  it('uses the given exclusions (Hong Kong by default)', () => {
    expect(read('香港 中山').names).toEqual(['中山']);
    expect(extractFallbackStops('深圳 中山', 2, places, ['hongkong-hongkong-hongkong', 'china-guangdong-shenzhen']).stops.map(s => s.cityId))
      .toEqual(['china-guangdong-zhongshan']);
  });
});
