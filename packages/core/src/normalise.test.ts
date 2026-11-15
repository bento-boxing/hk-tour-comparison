import { describe, it, expect } from 'vitest';
import { addDays, normaliseTour, places, buildPlacesIndex } from './index';
import type { ScrapedTour } from './index';

/** The valid tour from schema.test.ts, with a Japan route and one past departure. */
const base: ScrapedTour = {
  operatorId: 'jetour', code: 'THB', url: 'https://www.jetour.com.hk/tour/THB',
  title: '曼谷芭堤雅5天', days: 5, nights: 4,
  dayHeadings: ['香港 → 大阪', '大阪 → 京都'],
  startPoint: null, endPoint: null, fromPriceHkd: 3999,
  departures: [
    { date: '2026-12-22', priceHkd: 8299 },
    { date: '2026-12-18', priceHkd: 7999 },
    { date: '2026-11-01', priceHkd: 5000 },
  ],
};

const today = '2026-11-12';
it('normalises a good tour', () => {
  const r = normaliseTour(base, places, today);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.tour.stops.map(s => s.cityId)).toEqual(['japan-kansai-osaka', 'japan-kansai-kyoto']);
  expect(r.tour.departures.map(d => d.date)).toEqual(['2026-12-18', '2026-12-22']); // past date dropped, sorted
  expect(r.tour.fromPriceHkd).toBe(7999);
  expect(r.tour.start).toEqual({ kind: 'hk', label: null });
});
it('uses the scraped from-price when no departure has a price', () => {
  const r = normaliseTour({ ...base, fromPriceHkd: 6000, departures: [{ date: '2026-12-18', priceHkd: null }] }, places, today);
  expect(r.ok && r.tour.fromPriceHkd).toBe(6000);
});
describe('when some upcoming departures have no price of their own', () => {
  // They are shown, filtered and chained at the stored from-price (search.ts EFFECTIVE_PRICE): the operator's own
  // "from" price counts toward it, so a date without a price is never shown above the price the operator states.
  const mixed = [{ date: '2026-12-18', priceHkd: 7999 }, { date: '2027-01-10', priceHkd: null }];
  it('the from-price is the scraped one when it is lower than every priced departure', () => {
    const r = normaliseTour({ ...base, fromPriceHkd: 6999, departures: mixed }, places, today);
    expect(r.ok && r.tour.fromPriceHkd).toBe(6999);
  });
  it('the from-price is the lowest priced departure when that is lower', () => {
    const r = normaliseTour({ ...base, fromPriceHkd: 8999, departures: mixed }, places, today);
    expect(r.ok && r.tour.fromPriceHkd).toBe(7999);
  });
  it('without a scraped from-price, it is the lowest priced departure', () => {
    const r = normaliseTour({ ...base, fromPriceHkd: null, departures: mixed }, places, today);
    expect(r.ok && r.tour.fromPriceHkd).toBe(7999);
  });
  it('a past departure without a price does not count', () => {
    const r = normaliseTour({ ...base, fromPriceHkd: 3999, departures: [{ date: '2026-12-18', priceHkd: 7999 }, { date: '2026-11-01', priceHkd: null }] }, places, today);
    expect(r.ok && r.tour.fromPriceHkd).toBe(7999);
  });
});
it('de-duplicates dates keeping the lowest price', () => {
  const r = normaliseTour({ ...base, departures: [{ date: '2026-12-18', priceHkd: 9000 }, { date: '2026-12-18', priceHkd: 8000 }] }, places, today);
  expect(r.ok && r.tour.departures).toEqual([{ date: '2026-12-18', priceHkd: 8000 }]);
});
it.each([
  ['no-stops', { dayHeadings: [] }],
  ['no-stops', { dayHeadings: ['香港 → 亞特蘭提斯'] }],
  ['no-departures', { departures: [] }],
  ['no-departures', { departures: [{ date: '2026-11-11', priceHkd: 5000 }] }],
  ['no-price', { fromPriceHkd: null, departures: [{ date: '2026-12-18', priceHkd: null }] }],
])('rejects with %s', (reason, patch) => {
  const r = normaliseTour({ ...base, ...patch }, places, today);
  expect(r).toMatchObject({ ok: false, reason });
});
it('skips a tour with no upcoming departures as no-departures even when no stop matches, still reporting unmatched names', () => {
  const r = normaliseTour({ ...base, dayHeadings: ['香港 → 亞特蘭提斯'], departures: [{ date: '2026-11-11', priceHkd: 5000 }] }, places, today);
  expect(r).toEqual({ ok: false, reason: 'no-departures', unmatched: ['亞特蘭提斯'] });
  expect(normaliseTour({ ...base, dayHeadings: [], departures: [] }, places, today))
    .toEqual({ ok: false, reason: 'no-departures', unmatched: [] });
});
it('reports unmatched names on rejection', () => {
  const r = normaliseTour({ ...base, dayHeadings: ['香港 → 亞特蘭提斯'] }, places, today);
  expect(r.unmatched).toEqual(['亞特蘭提斯']);
});
it('drops Shenzhen from the route for a Shenzhen-start tour', () => {
  const r = normaliseTour({ ...base, startPoint: '深圳灣口岸', dayHeadings: ['深圳 → 桂林', '桂林 → 深圳'] }, places, today);
  expect(r.ok && r.tour.stops.map(s => s.cityId)).toEqual(['china-guangxi-guilin']);
  expect(r.ok && r.tour.start.kind).toBe('sz');
});
it('normalises a tour starting at a foreign airport as an other start', () => {
  const r = normaliseTour({ ...base, startPoint: '東京成田機場集合' }, places, today);
  expect(r.ok && r.tour.start).toEqual({ kind: 'other', label: '東京成田機場集合' });
});
it('passes its own index to the start-point rule', () => {
  const withoutTokyo = buildPlacesIndex({
    ...places.data,
    cities: places.data.cities.filter(c => c.id !== 'japan-kanto-tokyo'),
  });
  const r = normaliseTour({ ...base, startPoint: '東京成田機場集合' }, withoutTokyo, today);
  expect(r.ok && r.tour.start).toEqual({ kind: 'hk', label: null });
});
it('reports the raw headings, cut to 40 characters, when nothing was flagged unmatched', () => {
  const heading = 'x'.repeat(45);
  const r = normaliseTour({ ...base, dayHeadings: [heading, 'Day 2'] }, places, today);
  expect(r).toEqual({ ok: false, reason: 'no-stops', unmatched: ['x'.repeat(40), 'Day 2'], unmatchedAreHeadings: true });
});
it('says when the reported names are heading text rather than unmatched place words, so a public log can leave them out', () => {
  expect(normaliseTour({ ...base, dayHeadings: ['香港 → 亞特蘭提斯'] }, places, today)).not.toHaveProperty('unmatchedAreHeadings');
  expect(normaliseTour({ ...base, dayHeadings: ['自由活動 → 酒店'] }, places, today))
    .toMatchObject({ ok: false, reason: 'no-stops', unmatched: ['自由活動 → 酒店'], unmatchedAreHeadings: true });
});
it('drops Shenzhen from the route when only the end point is in Shenzhen', () => {
  const r = normaliseTour({ ...base, endPoint: '羅湖口岸散團', dayHeadings: ['深圳 → 桂林', '桂林 → 深圳'] }, places, today);
  expect(r.ok && r.tour.stops.map(s => s.cityId)).toEqual(['china-guangxi-guilin']);
  expect(r.ok && r.tour.end.kind).toBe('sz');
});
it('a stated start point is not the first stop: a tour from 澳門外港碼頭 does not start its route with 澳門', () => {
  const r = normaliseTour({ ...base, startPoint: '澳門外港碼頭', dayHeadings: ['澳門 → 珠海', '珠海 → 中山'] }, places, today);
  expect(r.ok && r.tour.stops.map(s => s.cityId)).toEqual(['china-guangdong-zhuhai', 'china-guangdong-zhongshan']);
  expect(r.ok && r.tour.start).toEqual({ kind: 'other', label: '澳門外港碼頭' }); // the card's note stays
});
it('a stated end point is not the last stop', () => {
  const r = normaliseTour({ ...base, endPoint: '澳門外港碼頭', dayHeadings: ['香港 → 中山', '中山 → 珠海 → 澳門'] }, places, today);
  expect(r.ok && r.tour.stops.map(s => s.cityId)).toEqual(['china-guangdong-zhongshan', 'china-guangdong-zhuhai']);
  expect(r.ok && r.tour.end).toEqual({ kind: 'other', label: '澳門外港碼頭' });
});
it('a stated start or end place in the middle of the route stays', () => {
  const headings = ['珠海 → 澳門', '澳門 → 中山'];
  const fromMacau = normaliseTour({ ...base, startPoint: '澳門外港碼頭', endPoint: '澳門外港碼頭', dayHeadings: headings }, places, today);
  expect(fromMacau.ok && fromMacau.tour.stops.map(s => s.cityId))
    .toEqual(['china-guangdong-zhuhai', 'macau-macau-macau', 'china-guangdong-zhongshan']);
  const fromHk = normaliseTour({ ...base, dayHeadings: headings }, places, today);
  expect(fromHk.ok && fromHk.tour.stops.map(s => s.cityId))
    .toEqual(['china-guangdong-zhuhai', 'macau-macau-macau', 'china-guangdong-zhongshan']);
});
it('a route that starts and ends at the stated start and end place loses both ends', () => {
  const r = normaliseTour({ ...base, startPoint: '澳門外港碼頭', endPoint: '澳門外港碼頭', dayHeadings: ['澳門 → 珠海', '珠海 → 澳門'] }, places, today);
  expect(r.ok && r.tour.stops.map(s => s.cityId)).toEqual(['china-guangdong-zhuhai']);
});
it('a route whose only stop is the stated start place has no stops left (as a Hong Kong-only route)', () => {
  const r = normaliseTour({ ...base, startPoint: '澳門外港碼頭', dayHeadings: ['澳門'] }, places, today);
  expect(r).toMatchObject({ ok: false, reason: 'no-stops' });
});
it('keeps Shenzhen on the route of a Hong Kong-start tour', () => {
  const r = normaliseTour({ ...base, dayHeadings: ['香港 → 深圳', '深圳 → 桂林'] }, places, today);
  expect(r.ok && r.tour.stops.map(s => s.cityId)).toEqual(['china-guangdong-shenzhen', 'china-guangxi-guilin']);
});
it('drops a departure dated today: it has left by the time anyone reads the card', () => {
  const tomorrow = addDays(today, 1);
  const r = normaliseTour({ ...base, departures: [{ date: today, priceHkd: 7000 }, { date: tomorrow, priceHkd: 7500 }] }, places, today);
  expect(r.ok && r.tour.departures).toEqual([{ date: tomorrow, priceHkd: 7500 }]);
  expect(r.ok && r.tour.fromPriceHkd).toBe(7500);
});
it('a tour whose only departure is today has no upcoming departures', () => {
  const r = normaliseTour({ ...base, departures: [{ date: today, priceHkd: 7000 }] }, places, today);
  expect(r).toMatchObject({ ok: false, reason: 'no-departures' });
});

describe('the fallback route (Big Line: its title, owner decision 2026-11-14)', () => {
  /** Day headings that name no place: what about 31% of Big Line's pages hold. */
  const noPlaces = { dayHeadings: ['香港 → 溫泉 → 入住酒店', '早餐 → 亞特蘭提斯'] };
  const cityIds = (r: ReturnType<typeof normaliseTour>) => (r.ok ? r.tour.stops.map(s => s.cityId) : null);

  it('gives the stops when the day headings match none', () => {
    const r = normaliseTour({ ...base, ...noPlaces, fallbackRoute: '京都賞楓5天' }, places, today);
    expect(cityIds(r)).toEqual(['japan-kansai-kyoto']);
  });
  it('is not read when the day headings match even one stop: no title places are mixed into a working route', () => {
    const r = normaliseTour({ ...base, dayHeadings: ['香港 → 大阪', '溫泉'], fallbackRoute: '京都 奈良 5天' }, places, today);
    expect(cityIds(r)).toEqual(['japan-kansai-osaka']);
  });
  it('is read when the only stop the headings name is the stated start place, which leaves none', () => {
    const r = normaliseTour({ ...base, startPoint: '澳門外港碼頭', dayHeadings: ['澳門'], fallbackRoute: '珠海2天' }, places, today);
    expect(cityIds(r)).toEqual(['china-guangdong-zhuhai']);
  });
  it('keeps the order of appearance', () => {
    expect(cityIds(normaliseTour({ ...base, ...noPlaces, fallbackRoute: '京都、大阪6天' }, places, today)))
      .toEqual(['japan-kansai-kyoto', 'japan-kansai-osaka']);
    expect(cityIds(normaliseTour({ ...base, ...noPlaces, fallbackRoute: '大阪 京都 6天' }, places, today)))
      .toEqual(['japan-kansai-osaka', 'japan-kansai-kyoto']);
  });
  it('is read with the day-heading rules: Hong Kong, the Shenzhen start and notPlaces guards as for headings', () => {
    expect(cityIds(normaliseTour({ ...base, ...noPlaces, fallbackRoute: '香港 京都5天' }, places, today)))
      .toEqual(['japan-kansai-kyoto']);
    expect(normaliseTour({ ...base, ...noPlaces, fallbackRoute: '香港美食2天' }, places, today))
      .toMatchObject({ ok: false, reason: 'no-stops' });
    expect(cityIds(normaliseTour({ ...base, ...noPlaces, startPoint: '深圳灣口岸', fallbackRoute: '深圳 惠州2天' }, places, today)))
      .toEqual(['china-guangdong-huizhou']);
    // 普洱茶 is a notPlaces entry: the tea is not a visit to Pu'er, in a title as in a heading.
    expect(normaliseTour({ ...base, ...noPlaces, fallbackRoute: '普洱茶品茗2天' }, places, today))
      .toMatchObject({ ok: false, reason: 'no-stops' });
  });
  it('that matches nothing either leaves the tour no-stops, exactly as without it', () => {
    const without = normaliseTour({ ...base, ...noPlaces }, places, today);
    expect(without).toMatchObject({ ok: false, reason: 'no-stops' });
    expect(normaliseTour({ ...base, ...noPlaces, fallbackRoute: '溫泉美食 夢幻樂園2天' }, places, today)).toEqual(without);
    expect(normaliseTour({ ...base, dayHeadings: [], fallbackRoute: '溫泉美食2天' }, places, today))
      .toEqual(normaliseTour({ ...base, dayHeadings: [] }, places, today));
  });
  it('does not add its own words to the unmatched names; the headings\' still are', () => {
    const r = normaliseTour({ ...base, ...noPlaces, fallbackRoute: '京都 夢幻樂園 雪見溫泉5天' }, places, today);
    expect(r.ok).toBe(true);
    expect(r.unmatched).toEqual(['溫泉', '亞特蘭提斯']);
    expect(r.unmatched).toEqual(normaliseTour({ ...base, ...noPlaces }, places, today).unmatched);
  });
  it('leaves a tour with nothing to book no-departures, as before', () => {
    const r = normaliseTour({ ...base, ...noPlaces, fallbackRoute: '京都5天', departures: [] }, places, today);
    expect(r).toEqual(normaliseTour({ ...base, ...noPlaces, departures: [] }, places, today));
    expect(r).toMatchObject({ ok: false, reason: 'no-departures' });
  });
  it('is opt-in: without one (every other operator), a title naming a place is never read', () => {
    const r = normaliseTour({ ...base, ...noPlaces, title: '京都賞楓5天' }, places, today);
    expect(r).toMatchObject({ ok: false, reason: 'no-stops' });
  });
  it('drops a stated start or end place at its edges, as for headings', () => {
    // Remove the withoutStatedEnds call on the fallback path and this fails.
    const r = normaliseTour({ ...base, ...noPlaces, startPoint: '澳門外港碼頭', endPoint: '中山碼頭', fallbackRoute: '澳門 珠海 中山3天' }, places, today);
    expect(cityIds(r)).toEqual(['china-guangdong-zhuhai']);
  });
  it('says whether the route came from it', () => {
    expect(normaliseTour({ ...base, ...noPlaces, fallbackRoute: '京都5天' }, places, today)).toMatchObject({ ok: true, routeFromFallback: true });
    expect(normaliseTour({ ...base, fallbackRoute: '京都5天' }, places, today)).toMatchObject({ ok: true, routeFromFallback: false });
    expect(normaliseTour(base, places, today)).toMatchObject({ ok: true, routeFromFallback: false });
  });
  it('is read with the fallback rules, and lists what they dropped', () => {
    // 小香格里拉 is a comparison; 高山 (Takayama) is too far for 3 days; 中山 stays.
    const r = normaliseTour({ ...base, ...noPlaces, days: 3, fallbackRoute: '廣東小香格里拉 高山紅葉 中山3天' }, places, today);
    expect(cityIds(r)).toEqual(['china-guangdong-zhongshan']);
    expect(r).toMatchObject({ fallbackDropped: [{ name: '香格里拉', rule: 'comparison' }, { name: '高山', rule: 'too-far' }] });
  });
  it('a title whose every place the rules drop leaves the tour no-stops, listing the drops', () => {
    const r = normaliseTour({ ...base, ...noPlaces, days: 2, fallbackRoute: '東方威尼斯 高山溫泉2天' }, places, today);
    expect(r).toMatchObject({ ok: false, reason: 'no-stops', fallbackDropped: [{ name: '威尼斯', rule: 'comparison' }, { name: '高山', rule: 'too-far' }] });
    expect(r.unmatched).toEqual(normaliseTour({ ...base, ...noPlaces }, places, today).unmatched);
  });
  it('lists an airline the rules passed over, and does not report it as unmatched', () => {
    const r = normaliseTour({ ...base, ...noPlaces, fallbackRoute: '澳門航空直飛京都5天' }, places, today);
    expect(cityIds(r)).toEqual(['japan-kansai-kyoto']);
    expect(r).toMatchObject({ fallbackDropped: [{ name: '澳門', rule: 'airline' }] });
    expect(r.unmatched).toEqual(normaliseTour({ ...base, ...noPlaces }, places, today).unmatched);
  });
  it('lists no drops when the rules drop nothing', () => {
    expect(normaliseTour({ ...base, ...noPlaces, fallbackRoute: '京都5天' }, places, today)).not.toHaveProperty('fallbackDropped');
  });
  it('is read when the day-line rules leave no stop, each list naming its own drops', () => {
    // the comparison in the day heading is dropped there (task 35), so the title is read
    const r = normaliseTour({ ...base, days: 2, dayHeadings: ['廣東小香格里拉'], fallbackRoute: '中山2天' }, places, today);
    expect(cityIds(r)).toEqual(['china-guangdong-zhongshan']);
    expect(r).toMatchObject({ ok: true, routeFromFallback: true, dayHeadingsDropped: [{ name: '香格里拉', rule: 'comparison' }] });
    expect(r).not.toHaveProperty('fallbackDropped');
  });
});

describe('the day-line rules (owner decision 2026-11-15: comparisons and too far for the trip)', () => {
  const cityIds = (r: ReturnType<typeof normaliseTour>) => (r.ok ? r.tour.stops.map(s => s.cityId ?? `region:${s.regionId}`) : r.reason);

  it('drop a comparison from a day-line route and list it', () => {
    const r = normaliseTour({ ...base, dayHeadings: ['香港 → 東方威尼斯水鄉 → 大阪', '大阪 → 京都'] }, places, today);
    expect(cityIds(r)).toEqual(['japan-kansai-osaka', 'japan-kansai-kyoto']);
    expect(r).toMatchObject({ dayHeadingsDropped: [{ name: '威尼斯', rule: 'comparison' }] });
  });
  it('drop a place too far for a short trip, using the tour\'s days', () => {
    const headings = ['香港 → 中山', '高山賞紅葉 → 珠海'];
    const short = normaliseTour({ ...base, days: 3, dayHeadings: headings }, places, today);
    expect(cityIds(short)).toEqual(['china-guangdong-zhongshan', 'china-guangdong-zhuhai']);
    expect(short).toMatchObject({ dayHeadingsDropped: [{ name: '高山', rule: 'too-far' }] });
    expect(cityIds(normaliseTour({ ...base, days: 4, dayHeadings: headings }, places, today)))
      .toEqual(['china-guangdong-zhongshan', 'japan-chubu-takayama', 'china-guangdong-zhuhai']);
  });
  it('list nothing when they drop nothing', () => {
    expect(normaliseTour(base, places, today)).not.toHaveProperty('dayHeadingsDropped');
  });
  it('leave the tour no-stops when they drop every stop and there is no fallback, listing the drops', () => {
    const r = normaliseTour({ ...base, days: 2, dayHeadings: ['香港 → 東方威尼斯水鄉'] }, places, today);
    expect(r).toMatchObject({ ok: false, reason: 'no-stops', dayHeadingsDropped: [{ name: '威尼斯', rule: 'comparison' }] });
  });
  it('keep a short route whose every stop is out of reach: a trip elsewhere, nothing listed', () => {
    const r = normaliseTour({ ...base, days: 2, dayHeadings: ['香港 → 高山'] }, places, today);
    expect(cityIds(r)).toEqual(['japan-chubu-takayama']);
    expect(r).not.toHaveProperty('dayHeadingsDropped');
  });
  it('list their drops on a tour with nothing to book too', () => {
    const r = normaliseTour({ ...base, days: 2, dayHeadings: ['香港 → 中山 → 高山 → 珠海'], departures: [] }, places, today);
    expect(r).toEqual({ ok: false, reason: 'no-departures', unmatched: [], dayHeadingsDropped: [{ name: '高山', rule: 'too-far' }] });
  });
  it('list their drops on a tour with no price too', () => {
    const r = normaliseTour({
      ...base, days: 2, dayHeadings: ['香港 → 中山 → 高山 → 珠海'], fromPriceHkd: null, departures: [{ date: '2026-12-18', priceHkd: null }],
    }, places, today);
    expect(r).toEqual({ ok: false, reason: 'no-price', unmatched: [], dayHeadingsDropped: [{ name: '高山', rule: 'too-far' }] });
  });
  it('leave a place the stated end names to the stated-ends step: it goes from the edge, not listed as too far (fix round 3)', () => {
    const r = normaliseTour({ ...base, days: 2, endPoint: '東京成田機場解散', dayHeadings: ['香港 → 中山', '中山 → 珠海 → 東京'] }, places, today);
    expect(cityIds(r)).toEqual(['china-guangdong-zhongshan', 'china-guangdong-zhuhai']);
    expect(r).not.toHaveProperty('dayHeadingsDropped');
    // with no stated end, the same place is too far and listed
    const unstated = normaliseTour({ ...base, days: 2, dayHeadings: ['香港 → 中山', '中山 → 珠海 → 東京'] }, places, today);
    expect(cityIds(unstated)).toEqual(['china-guangdong-zhongshan', 'china-guangdong-zhuhai']);
    expect(unstated).toMatchObject({ dayHeadingsDropped: [{ name: '東京', rule: 'too-far' }] });
  });
  it('come before dropping a province beside its own city (the opt-in): a province and its city go together', () => {
    const r = normaliseTour({ ...base, days: 3, dropRegionWithListedCity: true, dayHeadings: ['雲南', '大理', '中山', '珠海', '江門'] }, places, today);
    expect(cityIds(r)).toEqual(['china-guangdong-zhongshan', 'china-guangdong-zhuhai', 'china-guangdong-jiangmen']);
    expect(r).toMatchObject({ dayHeadingsDropped: [{ name: '雲南', rule: 'too-far' }, { name: '大理', rule: 'too-far' }] });
  });
  describe('leave a place the stated start or end names out of the count (fix round 3)', () => {
    it('a tour from one stated gateway back to another keeps its destination', () => {
      const r = normaliseTour({ ...base, days: 3, startPoint: '珠海拱北口岸', endPoint: '澳門外港碼頭', dayHeadings: ['珠海 → 東京', '東京 → 澳門'] }, places, today);
      expect(cityIds(r)).toEqual(['japan-kanto-tokyo']);
      expect(r).not.toHaveProperty('dayHeadingsDropped');
    });
    it('the other places are still compared: two within reach against one, so 上海 goes', () => {
      const r = normaliseTour({ ...base, days: 2, startPoint: '珠海拱北口岸', dayHeadings: ['珠海 → 廣州 → 上海', '佛山'] }, places, today);
      expect(cityIds(r)).toEqual(['china-guangdong-guangzhou', 'china-guangdong-foshan']);
      expect(r).toMatchObject({ dayHeadingsDropped: [{ name: '上海', rule: 'too-far' }] });
    });
    it('one within reach against one beyond, with the gateway left out: nothing is dropped, then the gateway goes as the stated start', () => {
      const r = normaliseTour({ ...base, days: 3, startPoint: '珠海拱北口岸', dayHeadings: ['珠海 → 中山', '首爾'] }, places, today);
      expect(cityIds(r)).toEqual(['china-guangdong-zhongshan', 'korea-seoul-seoul']);
      expect(r).not.toHaveProperty('dayHeadingsDropped');
    });
    it('a Shenzhen start (excluded before the rule) behaves as before', () => {
      const r = normaliseTour({ ...base, days: 3, startPoint: '深圳灣口岸', dayHeadings: ['深圳 → 首爾', '首爾'] }, places, today);
      expect(cityIds(r)).toEqual(['korea-seoul-seoul']);
      expect(r).not.toHaveProperty('dayHeadingsDropped');
    });
  });
  it('count a stated gateway as within reach, so it never outweighs the destination; the stated-ends step then removes it', () => {
    // fix round 2: a short flight package from a stated Zhuhai or Macau gateway keeps its destination
    const zhuhai = normaliseTour({ ...base, days: 2, startPoint: '珠海拱北口岸', dayHeadings: ['珠海 → 東京'] }, places, today);
    expect(cityIds(zhuhai)).toEqual(['japan-kanto-tokyo']);
    expect(zhuhai).not.toHaveProperty('dayHeadingsDropped');
    const macau = normaliseTour({ ...base, days: 3, startPoint: '澳門外港碼頭', dayHeadings: ['澳門 → 大阪', '大阪 → 京都'] }, places, today);
    expect(cityIds(macau)).toEqual(['japan-kansai-osaka', 'japan-kansai-kyoto']);
    expect(macau).not.toHaveProperty('dayHeadingsDropped');
  });
});

describe('several fallback texts, read in order (Sunflower: title, subarea, area)', () => {
  const noPlaces = { dayHeadings: [] as string[] };
  const cityIds = (r: ReturnType<typeof normaliseTour>) => (r.ok ? r.tour.stops.map(s => s.cityId ?? `region:${s.regionId}`) : r.reason);

  it('takes the first text that gives a stop, and reads no later one', () => {
    expect(cityIds(normaliseTour({ ...base, ...noPlaces, fallbackRoute: ['溫泉美食5天', '京都', '大阪'] }, places, today)))
      .toEqual(['japan-kansai-kyoto']);
    expect(normaliseTour({ ...base, ...noPlaces, fallbackRoute: ['溫泉美食5天', '京都'] }, places, today))
      .toMatchObject({ ok: true, routeFromFallback: true });
  });
  it('falls through a text whose every place the rules drop, listing the drops', () => {
    const r = normaliseTour({ ...base, ...noPlaces, days: 2, fallbackRoute: ['東方威尼斯 高山溫泉2天', '中山'] }, places, today);
    expect(cityIds(r)).toEqual(['china-guangdong-zhongshan']);
    expect(r).toMatchObject({ fallbackDropped: [{ name: '威尼斯', rule: 'comparison' }, { name: '高山', rule: 'too-far' }] });
  });
  it('leaves the tour no-stops when none gives a stop, as with no fallback', () => {
    expect(normaliseTour({ ...base, ...noPlaces, fallbackRoute: ['溫泉', '美食'] }, places, today))
      .toEqual(normaliseTour({ ...base, ...noPlaces }, places, today));
  });
  it('one text in a list reads as that text alone', () => {
    expect(normaliseTour({ ...base, ...noPlaces, fallbackRoute: ['京都賞楓5天'] }, places, today))
      .toEqual(normaliseTour({ ...base, ...noPlaces, fallbackRoute: '京都賞楓5天' }, places, today));
  });
  it('drops a province beside its own city in a text when the operator opts in, as for headings', () => {
    expect(cityIds(normaliseTour({ ...base, ...noPlaces, dropRegionWithListedCity: true, fallbackRoute: ['廣西 桂林5天'] }, places, today)))
      .toEqual(['china-guangxi-guilin']);
    expect(cityIds(normaliseTour({ ...base, ...noPlaces, fallbackRoute: ['廣西 桂林5天'] }, places, today)))
      .toEqual(['region:china-guangxi', 'china-guangxi-guilin']);
  });
});

describe('a Shenzhen day trip gathering at the Shenzhen border', () => {
  const szTrip = { ...base, days: 2, dayHeadings: [] as string[], startPoint: '深圳關口', endPoint: '深圳關口' };
  const cityIds = (r: ReturnType<typeof normaliseTour>) => (r.ok ? r.tour.stops.map(s => s.cityId) : r.reason);

  it('visits Shenzhen when its fallback text names Shenzhen and no other place', () => {
    expect(cityIds(normaliseTour({ ...szTrip, fallbackRoute: ['2天深圳純玩團', '廣州、中山、深圳'] }, places, today)))
      .toEqual(['china-guangdong-shenzhen']);
    expect(cityIds(normaliseTour({ ...szTrip, fallbackRoute: '深圳美食2天' }, places, today))).toEqual(['china-guangdong-shenzhen']);
  });
  it('still leaves Shenzhen out when the text names another place too', () => {
    expect(cityIds(normaliseTour({ ...szTrip, fallbackRoute: '深圳 東莞2天' }, places, today))).toEqual(['china-guangdong-dongguan']);
  });
  it('day headings naming only Shenzhen are read as before (no stop)', () => {
    expect(cityIds(normaliseTour({ ...szTrip, dayHeadings: ['深圳'] }, places, today))).toBe('no-stops');
  });
  it('a tour gathering in Hong Kong is not changed: Hong Kong is never a stop', () => {
    expect(cityIds(normaliseTour({ ...szTrip, startPoint: null, endPoint: null, fallbackRoute: '香港美食2天' }, places, today))).toBe('no-stops');
  });
});

describe('dropping a region whose city is listed (Yummy Holiday, owner decision 2026-11-14)', () => {
  /** City id, or `region:<id>` for a region-only stop. */
  const route = (dayHeadings: string[], dropRegionWithListedCity?: true) => {
    const r = normaliseTour({ ...base, dayHeadings, ...(dropRegionWithListedCity ? { dropRegionWithListedCity } : {}) }, places, today);
    return r.ok ? r.tour.stops.map(s => s.cityId ?? `region:${s.regionId}`) : r.reason;
  };
  it('drops a leading region when a city of it is listed', () => {
    expect(route(['雲南', '大理', '瀘沽湖', '麗江', '昆明'], true)).toEqual([
      'china-yunnan-dali', 'china-yunnan-lugu-lake', 'china-yunnan-lijiang', 'china-yunnan-kunming',
    ]);
  });
  it('drops a region in the middle of the list when a city of it is listed', () => {
    expect(route(['清遠', '雲南', '大理'], true)).toEqual(['china-guangdong-qingyuan', 'china-yunnan-dali']);
  });
  it('drops a region whose city comes only before it: the list is a set of tags, not an order', () => {
    expect(route(['大理', '麗江', '雲南'], true)).toEqual(['china-yunnan-dali', 'china-yunnan-lijiang']);
  });
  it('drops a province only for its own cities: 湖北 beside a Jiangxi city stays (task 37, when both were 華中 it went)', () => {
    expect(route(['湖北', '南昌'], true)).toEqual(['region:china-hubei', 'china-central-nanchang']);
    expect(route(['湖北', '武漢'], true)).toEqual(['china-central-wuhan']);
  });
  it('keeps a region none of whose cities is listed', () => {
    expect(route(['雲南', '清遠'], true)).toEqual(['region:china-yunnan', 'china-guangdong-qingyuan']);
    expect(route(['雲南'], true)).toEqual(['region:china-yunnan']);
  });
  it('removes a repeat that dropping a region leaves side by side', () => {
    expect(route(['昆明', '雲南', '昆明'], true)).toEqual(['china-yunnan-kunming']);
  });
  it('is opt-in: without it (every other operator) a region stays a stop', () => {
    expect(route(['雲南', '大理', '瀘沽湖', '麗江', '昆明'])).toEqual([
      'region:china-yunnan', 'china-yunnan-dali', 'china-yunnan-lugu-lake', 'china-yunnan-lijiang', 'china-yunnan-kunming',
    ]);
    expect(route(['昆明', '雲南', '昆明'])).toEqual(['china-yunnan-kunming', 'region:china-yunnan', 'china-yunnan-kunming']);
  });
});
