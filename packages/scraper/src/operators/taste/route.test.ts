import { describe, expect, it } from 'vitest';
import { extractDayLineStops, places, type Stop } from '@hktours/core';
import { HUBS_NOT_IN_DATA, withoutConnections } from './route';

const names = (stops: Stop[]) => stops.map(s => (s.cityId !== null ? places.city(s.cityId)!.nameZh : places.region(s.regionId)!.nameZh));
/** The route the shared day-line rules read from the lines, as normaliseTour gives them (Hong Kong left out). */
const route = (lines: string[], days = 9) => names(extractDayLineStops(lines, days, places).stops);

describe('Taste: connections offered as a choice are not stops (task 48)', () => {
  it('a choice of flight hubs on the first and last days, and on the day after an overnight flight, names no stop', () => {
    const lines = ['香港 → 杜拜/多哈/伊斯坦堡 → 開羅 → 吉薩', '開羅 → 樂蜀', '樂蜀 → 開羅 → 杜拜/多哈/伊斯坦堡', '杜拜/多哈/伊斯坦堡 → 香港'];
    expect(route(lines)).toEqual(['杜拜', '伊斯坦堡', '開羅', '吉薩', '開羅', '樂蜀', '開羅', '杜拜', '伊斯坦堡', '杜拜', '伊斯坦堡']);
    expect(route(withoutConnections(lines))).toEqual(['開羅', '吉薩', '開羅', '樂蜀', '開羅']);
    expect(route(withoutConnections(['香港→ 杜拜/蘇黎世/法蘭克福', '杜拜/蘇黎世/法蘭克福→ 巴黎 → 凡爾賽']))).toEqual(['巴黎', '凡爾賽']);
  });

  it('a hub named alone, when the tour also offers it as a choice, is the same connection', () => {
    expect(route(withoutConnections(['香港 →杜拜/赫爾辛基', '杜拜→ 羅馬 → 佛羅倫斯', '維也納 →杜拜/赫爾辛基']))).toEqual(['羅馬', '佛羅倫斯', '維也納']);
    expect(route(withoutConnections(['香港→杜拜 →杜拜/赫爾辛基/伊斯坦堡', '羅馬']))).toEqual(['羅馬']);
    // Without a choice offering it, a place named alone is a stop as before.
    expect(route(withoutConnections(['香港 → 杜拜 → 阿布扎比', '杜拜 → 香港']))).toEqual(['杜拜', '阿布扎比', '杜拜']);
  });

  it('only right next to the choice (fix round 1): a hub the tour spends a day in stays', () => {
    // The crawl's EEE10 shape: flown in by 杜拜/蘇黎世/法蘭克福, days in Zurich and Frankfurt later.
    const swiss = ['香港→ 杜拜/蘇黎世/法蘭克福', '杜拜/蘇黎世/法蘭克福→ 巴黎', '巴黎 → 琉森', '蘇黎世 → 蘇黎世湖', '法蘭克福 → 羅馬廣場', '法蘭克福 →杜拜/蘇黎世/法蘭克福'];
    expect(withoutConnections(swiss).slice(3, 5)).toEqual(['蘇黎世 → 蘇黎世湖', '法蘭克福 → 羅馬廣場']);
    expect(route(withoutConnections(swiss))).toEqual(['巴黎', '琉森', '蘇黎世', '法蘭克福']);
    // An Istanbul stopover day on an Egypt tour flown by 杜拜/伊斯坦堡: Istanbul stays, Dubai goes.
    const egypt = ['香港 → 杜拜/伊斯坦堡 → 開羅', '開羅 → 樂蜀', '樂蜀 → 伊斯坦堡', '伊斯坦堡 → 藍色清真寺', '伊斯坦堡 → 香港'];
    expect(route(withoutConnections(egypt), 5)).toEqual(['開羅', '樂蜀', '伊斯坦堡']);
    // Flying in via Zurich on a Swiss tour: the morning's Zurich stays, as the tour visits it.
    expect(route(withoutConnections(['香港 → 杜拜/蘇黎世', '蘇黎世 → 琉森', '琉森 → 蘇黎世', '杜拜/蘇黎世 → 香港']), 4))
      .toEqual(['蘇黎世', '琉森', '蘇黎世']);
  });

  it('a hub named only right beside its choice stays when the day is spent there (follow-up round)', () => {
    // The morning after `杜拜/赫爾辛基`, a line naming no other place: the day is spent in Helsinki.
    expect(route(withoutConnections(['香港 → 杜拜/赫爾辛基', '赫爾辛基 → 岩石教堂', '塔林 → 斯德哥爾摩', '斯德哥爾摩 → 杜拜/赫爾辛基 → 香港']), 4))
      .toEqual(['赫爾辛基', '塔林', '斯德哥爾摩']);
    // Just before the choice, but not straight after Hong Kong: the last day in Helsinki.
    expect(route(withoutConnections(['香港 → 杜拜/赫爾辛基', '杜拜/赫爾辛基 → 斯德哥爾摩', '斯德哥爾摩 → 塔林', '岩石教堂 → 赫爾辛基 → 杜拜/赫爾辛基 → 香港']), 4))
      .toEqual(['斯德哥爾摩', '塔林', '赫爾辛基']);
    // A 3-day Turkey tour naming Istanbul only on the arrival morning and the departure line keeps it.
    expect(route(withoutConnections(['香港 → 杜拜 → 杜拜/多哈/伊斯坦堡', '伊斯坦堡 → 藍色清真寺', '伊斯坦堡 → 杜拜/多哈/伊斯坦堡 → 香港']), 3))
      .toEqual(['伊斯坦堡']);
    // A Dubai tour naming Dubai only the morning after `杜拜/多哈` keeps it.
    expect(route(withoutConnections(['香港 → 杜拜/多哈', '杜拜 → 帆船酒店', '杜拜/多哈 → 香港']), 3)).toEqual(['杜拜']);
    // The crawl's two real removals still happen: the morning's line names another place (EEC09), the hub follows
    // Hong Kong (ETA13).
    expect(route(withoutConnections(['香港 →杜拜/赫爾辛基', '杜拜→ 羅馬 → 佛羅倫斯']))).toEqual(['羅馬', '佛羅倫斯']);
    expect(route(withoutConnections(['香港→杜拜 →杜拜/赫爾辛基/伊斯坦堡', '羅馬']))).toEqual(['羅馬']);
  });

  it('a lone hub beside a choice is no visit when deciding the choice (follow-up round): Dubai goes', () => {
    const lines = ['香港 → 杜拜 → 杜拜/伊斯坦堡', '伊斯坦堡 → 藍色清真寺', '伊斯坦堡 → 博斯普魯斯', '伊斯坦堡 → 杜拜/伊斯坦堡 → 香港'];
    expect(route(withoutConnections(lines), 4)).toEqual(['伊斯坦堡']);
    // A two-place choice whose other place is named only beside it goes, with that lone chunk.
    expect(route(withoutConnections(['香港 → 峴港', '峴港/會安', '會安 → 峴港 → 香港']), 3)).toEqual(['峴港']);
  });

  it('a choice of two places the tour visits anyway stays, so the tour keeps its stops', () => {
    // Both named on days of their own (a lone alternative beside the choice does not count: follow-up round).
    const lines = ['香港 → 峴港', '峴港/會安', '會安 → 峴港', '峴港 → 會安 → 香港'];
    expect(withoutConnections(lines)).toEqual(lines);
    expect(route(withoutConnections(lines), 4)).toEqual(['峴港', '會安', '峴港', '會安']);
    // A departure choice of Hong Kong or Macau, Macau visited: Hong Kong is never a stop, so the choice stays.
    expect(route(withoutConnections(['香港/澳門 → 大阪', '大阪 → 澳門']), 4)).toEqual(['澳門', '大阪', '澳門']);
  });

  it('every hub of HUBS_NOT_IN_DATA is still not in the places data (follow-up round)', () => {
    for (const hub of HUBS_NOT_IN_DATA) {
      const found = [...places.findCity(hub), ...places.findRegion(hub), ...places.findCountry(hub)];
      expect(found, `${hub} is now in the places data: remove it from HUBS_NOT_IN_DATA in route.ts`).toEqual([]);
    }
  });

  it('a hub the places data lacks (多哈) still makes a choice: 杜拜/多哈 names no stop (EMA09)', () => {
    const lines = ['香港 → 杜拜/多哈 → 卡薩布蘭加', '卡薩布蘭加 → 拉巴特', '拉巴特 → 杜拜/多哈', '杜拜/多哈 → 香港'];
    expect(route(lines)).toEqual(['杜拜', '卡薩布蘭加', '拉巴特', '杜拜']);
    expect(route(withoutConnections(lines))).toEqual(['卡薩布蘭加', '拉巴特']);
    expect(route(withoutConnections(['香港 → 多哈 → 杜拜']))).toEqual(['杜拜']); // no choice, as before
  });

  it('a choice of stations a train passes names no stop, with or without spaces around the slash', () => {
    const lines = ['香港西九龍站集合 → 乘高鐵經深圳北/廣州南站 → 昆明 → 大理', '大理 → 昆明 → 乘高鐵經廣州南站 / 深圳北站 → 香港西九龍站解散'];
    expect(route(lines, 6)).toEqual(['深圳', '廣州', '昆明', '大理', '昆明', '廣州', '深圳']);
    expect(route(withoutConnections(lines), 6)).toEqual(['昆明', '大理', '昆明']);
    // A transit word after a spaced slash now covers the whole chunk, as the shared rules mean it to.
    expect(route(withoutConnections(['桂林 → 陽朔', '桂林站 → 高鐵至廣州南站 / 深圳北站轉乘 → 香港']), 4)).toEqual(['桂林', '陽朔', '桂林']);
  });

  it('a place named right after 經 (via) is passed on the way, not visited; 經典 is no via', () => {
    expect(route(withoutConnections(['長沙 → 長沙南站 → 途經深圳北站 → 香港西九龍解散']), 5)).toEqual(['長沙']);
    expect(route(withoutConnections(['衡陽東站 → 經深圳北站 → 香港']), 5)).toEqual(['衡陽']);
    expect(route(withoutConnections(['重慶 → 重慶經典小吃', '經典歌曲廣州站']), 5)).toEqual(['重慶', '廣州']);
  });

  it('leaves a choice naming one place or none, or two names of one place, as it is', () => {
    for (const lines of [
      ['香港西九龍集合 → 懷化南/鳳凰古城站 → 晚餐'],
      ['桂林北/桂林西站 → 龍脊'],
      ['酒店 → 自由活動/購物'],
      ['深圳(福田/深圳灣)關口集合 → 博羅'],
    ]) expect(withoutConnections(lines)).toEqual(lines);
    expect(route(withoutConnections(['香港西九龍集合 → 懷化南/鳳凰古城站']), 5)).toEqual(['鳳凰古城']);
  });

  it('keeps bracketed notes, separators and the other chunks of a line as they were', () => {
    expect(withoutConnections(['香港 → 杜拜/伊斯坦堡(轉機) → 【開羅/吉薩】 開羅'])).toEqual(['香港 →  (轉機) → 【開羅/吉薩】 開羅']);
    expect(withoutConnections([])).toEqual([]);
  });
});
