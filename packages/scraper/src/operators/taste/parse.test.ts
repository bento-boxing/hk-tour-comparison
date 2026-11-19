import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  normaliseStartPoint, normaliseTour, places, scrapedTourSchema,
  type IsoDate, type ScrapedTour, type Stop,
} from '@hktours/core';
import { tourPageUrl } from './discover';
import { joinPage } from './fetch-page';
import { gatheringPoint, parse, readTour } from './parse';
import { publicDates, publicTourPage } from './public';
import { rawDate, rawDates, rawTourPage, type RawTourPage } from './test-responses';

const TODAY = '2026-11-20';
const PAGE = 'https://tastetravel.com.hk/tour/detail/tour_id/693';

/** readTour over a tour page and dates answer built in the test, trimmed and joined as fetchPage does. */
function read(page: RawTourPage = {}, dates = rawDates(), today: IsoDate = TODAY, url = PAGE) {
  return readTour(joinPage({ today, page: publicTourPage(rawTourPage(page)), dates: publicDates(dates)! }), url);
}
function tourOf(page?: RawTourPage, dates?: string, today?: IsoDate): ScrapedTour {
  const tour = read(page, dates, today);
  if ('why' in tour) throw new Error(`rejected: ${tour.why}`);
  return tour;
}
const stopNames = (stops: Stop[]) =>
  stops.map(s => (s.cityId !== null ? places.city(s.cityId)!.nameZh : places.region(s.regionId)!.nameZh));

describe('the tour', () => {
  it('reads code, title, days, the day lines, the gathering point and the "from" price; the tour page is its link', () => {
    expect(tourOf()).toEqual({
      operatorId: 'taste', code: 'CAK03', url: PAGE, title: '【江門】三天美食團', days: 3, nights: null,
      dayHeadings: [
        '深圳關口集合 → 午餐 → 江門 → 入住酒店',
        '酒店自助早餐 → 開平 → 新會',
        '酒店自助早餐 → 鶴山 → 深圳解散',
      ],
      fallbackRoute: '【江門】三天美食團',
      startPoint: '福田口岸 / 深圳灣口岸', endPoint: '福田口岸 / 深圳灣口岸', fromPriceHkd: 699,
      departures: [{ date: '2026-11-27', priceHkd: null }],
    });
  });

  it('passes the shared schema', () => {
    expect(scrapedTourSchema.safeParse(tourOf()).success).toBe(true);
  });

  it('is the tour page as tourPageUrl writes it, whatever else the page links', () => {
    expect(read({}, undefined, TODAY, 'https://tastetravel.com.hk/tour/detail/tour_id/1175')).toMatchObject({
      url: tourPageUrl('1175'),
    });
    expect(read({}, undefined, TODAY, 'https://tastetravel.com.hk/tour/event/tour_id/693')).toEqual({ why: 'not a Taste Travel tour page' });
    expect(readTour('<html></html>', PAGE)).toEqual({ why: 'not the joined tour page and dates answer' });
  });

  it('removes any HTML from the title, keeping angle-bracketed words that are not tags', () => {
    expect(tourOf({ title: '<全包價>埃及 開羅 9天 <br />新線' }).title).toBe('<全包價>埃及 開羅 9天 新線');
    expect(tourOf({ title: '  ' }).title).toBe('');
  });
});

describe('a parse failure: no guessing from other fields', () => {
  it.each([
    ['no tour code', { number: null }, 'the tour page has no tour code (.detail-number)'],
    ['an empty tour code', { number: '團號：' }, 'the tour page has no tour code (.detail-number)'],
    ['a code that is not plain', { number: '團號：CAK 03' }, 'the tour page has no tour code (.detail-number)'],
    ['no day count', { days: null }, 'the tour page has no day count (行程天數)'],
    ['a day count of 0', { days: '行程天數：0天' }, 'the tour page has no day count (行程天數)'],
    ['a day count over 60', { days: '行程天數：61天' }, 'the tour page has no day count (行程天數)'],
    ['no "from" price', { price: null }, 'the tour page has no "from" price (.detail-price .tig)'],
    ['a "from" price under 100', { price: '0' }, 'the tour page has no "from" price (.detail-price .tig)'],
  ] satisfies [string, RawTourPage, string][])('%s', (_, page, why) => {
    expect(read(page)).toEqual({ why });
  });

  it('the days are never read from the code or the title', () => {
    expect(read({ number: '團號：CAK03', days: null, title: '江門 3天' })).toEqual({ why: 'the tour page has no day count (行程天數)' });
  });

  it('a block page gives no tour', () => {
    expect(readTour(joinPage({ today: TODAY, page: publicTourPage('<html><body>Attention Required!</body></html>'), dates: [] }), PAGE))
      .toEqual({ why: 'the tour page has no tour code (.detail-number)' });
  });
});

describe('the departures', () => {
  const datesOf = (dates: Record<string, unknown>[], today: IsoDate = TODAY) => tourOf({}, rawDates(dates), today).departures;

  it('are every date of the dates answer on or after the run\'s date, each without a price of its own', () => {
    expect(datesOf([
      rawDate('2026-11-19', '已成團'), rawDate('2026-11-20', '收客中'), rawDate('2026-11-21', '已成團'),
      rawDate('2026-12-24', '快成團'), rawDate('2027-01-01', '收客中'),
    ])).toEqual([
      { date: '2026-11-20', priceHkd: null }, { date: '2026-11-21', priceHkd: null },
      { date: '2026-12-24', priceHkd: null }, { date: '2027-01-01', priceHkd: null },
    ]);
  });

  it('every departure has a null price: the site gives none per date', () => {
    const departures = datesOf(['2026-11-27', '2026-12-01', '2026-12-04'].map(date => ({ ...rawDate(date, '已成團'), price: 999 })));
    expect(departures).toHaveLength(3);
    for (const departure of departures) expect(departure.priceHkd).toBeNull();
  });

  it('takes the three statuses as bookable: 已成團 (confirmed), 快成團 (nearly) and 收客中 (taking bookings)', () => {
    expect(datesOf([rawDate('2026-12-01', '已成團'), rawDate('2026-12-02', '快成團'), rawDate('2026-12-03', '收客中')]).map(d => d.date))
      .toEqual(['2026-12-01', '2026-12-02', '2026-12-03']);
  });

  it('skips a date with any other status, so a future full or cancelled marker is never shown as bookable', () => {
    expect(datesOf([
      rawDate('2026-12-01', '額滿'), rawDate('2026-12-02', '已取消'), rawDate('2026-12-03', ''), { date: '2026-12-04' },
      { date: '2026-12-05', title: 7 }, rawDate('2026-12-06', '收客中'),
    ]).map(d => d.date)).toEqual(['2026-12-06']);
  });

  it('skips a date that is not a real YYYY-MM-DD date, and lists a date once, sorted', () => {
    expect(datesOf([
      rawDate('2026-12-10'), rawDate('2026-02-30'), rawDate('10/12/2026'), rawDate('2026-12-01'), rawDate('2026-12-10', '已成團'),
    ]).map(d => d.date)).toEqual(['2026-12-01', '2026-12-10']);
  });

  it('a tour with no date left is still a tour: normaliseTour skips it as no-departures', () => {
    const tour = tourOf({}, rawDates([rawDate('2026-11-01')]));
    expect(tour.departures).toEqual([]);
    expect(normaliseTour(tour, places, TODAY)).toMatchObject({ ok: false, reason: 'no-departures' });
  });

  it('every date is shown at the tour\'s "from" price, marked 起, by the mechanism built for Sunflower: unchanged', () => {
    const result = normaliseTour(tourOf({ price: '1999' }, rawDates([rawDate('2026-12-01'), rawDate('2026-12-05')])), places, TODAY);
    expect(result).toMatchObject({
      ok: true,
      tour: { fromPriceHkd: 1999, departures: [{ date: '2026-12-01', priceHkd: null }, { date: '2026-12-05', priceHkd: null }] },
    });
  });
});

describe('the gathering point', () => {
  it.each([
    ['options on the lines after the label', '集合時間地點<br />A: 早上 07:30AM 福田口岸<br />B: 早上 08:30AM 深圳灣口岸出門後SECRET<br /><br />留意:x', '福田口岸 / 深圳灣口岸'],
    ['on the label\'s own line', '行程編號: EED09-010925<br />集合時間地點 : 香港國際機場 <br />***SECRET***', '香港國際機場'],
    ['one option', '集合時間地點<br />A: 香港西九龍高鐵站G層團體集合處1號<br />留意:x', '香港西九龍高鐵站G層團體集合處1號'],
    ['a bracketed note cut off', '集合時間地點<br />A: 下午 1:30PM 羅湖口岸【SECRET】', '羅湖口岸'],
    ['no label', '行程編號: X<br />留意:x', null],
    ['a label with nothing after it', '集合時間地點<br />留意:x', null],
  ])('%s', (_, notice, expected) => {
    expect(gatheringPoint(notice)).toBe(expected);
    expect(tourOf({ notice }).startPoint).toBe(expected);
    expect(tourOf({ notice }).endPoint).toBe(expected);
  });

  it('is read as the other operators\' Hong Kong and Shenzhen gathering points are', () => {
    expect(normaliseStartPoint('福田口岸 / 深圳灣口岸')).toEqual({ kind: 'sz', label: null });
    expect(normaliseStartPoint('落馬洲火車站(福田口岸1號門) / 深圳灣口岸')).toEqual({ kind: 'sz', label: null });
    expect(normaliseStartPoint('香港國際機場')).toEqual({ kind: 'hk', label: null });
    expect(normaliseStartPoint('香港西九龍高鐵站G層團體集合處1號')).toEqual({ kind: 'hk', label: null });
    expect(normaliseStartPoint(null)).toEqual({ kind: 'hk', label: null });
  });

  it('is none without the booking notes', () => {
    expect(tourOf({ notice: null }).startPoint).toBeNull();
  });
});

describe('the route', () => {
  it('is the day lines through the shared place matching, the title only a fallback', () => {
    const tour = tourOf();
    expect(tour.fallbackRoute).toBe('【江門】三天美食團');
    const result = normaliseTour(tour, places, TODAY);
    // 深圳 is where the tour gathers (a Shenzhen checkpoint), so it is not a stop; 鶴山 is not in the places data.
    expect(result.ok && stopNames(result.tour.stops)).toEqual(['江門', '開平', '新會']);
    expect(result).toMatchObject({ routeFromFallback: false });
    expect(result.unmatched).toContain('鶴山');
  });

  it('takes its stops from the title when the day lines name places only inside 【】 (owner ruling, fix round 1)', () => {
    const tour = tourOf({ title: '江門•開平•新會 3天', dayLines: ['深圳關口集合 → 【開平虛構街】', '【新會虛構館】', '深圳解散'] });
    const result = normaliseTour(tour, places, TODAY);
    expect(result).toMatchObject({ ok: true, routeFromFallback: true });
    expect(result.ok && stopNames(result.tour.stops)).toEqual(['江門']);
  });

  it('never reads inside 【】, in the day lines or the title: a tour whose title names no place outside them stays no-stops', () => {
    const tour = tourOf({ title: '【江門虛構酒店】兩天', dayLines: ['深圳關口集合 → 【九江虛構館】', '深圳解散'], days: '行程天數：2天' });
    expect(normaliseTour(tour, places, TODAY)).toMatchObject({ ok: false, reason: 'no-stops' });
  });

  it('a title naming nothing still leaves a tour without stops no-stops; an empty title is no fallback', () => {
    const tour = tourOf({ title: '豪華酒店兩天', dayLines: ['深圳關口集合', '深圳解散'], days: '行程天數：2天' });
    expect(normaliseTour(tour, places, TODAY)).toMatchObject({ ok: false, reason: 'no-stops' });
    expect(tourOf({ title: '' })).not.toHaveProperty('fallbackRoute');
  });

  it('reads the site\'s other arrow, ⇨, as →, so places it joins without spaces are two places', () => {
    const tour = tourOf({ dayLines: ['香港⇨大阪 ⇨ 神戶', '京都⇨香港'], days: '行程天數：2天' });
    expect(tour.dayHeadings).toEqual(['香港→大阪 → 神戶', '京都→香港']);
    const result = normaliseTour(tour, places, TODAY);
    expect(result.ok && stopNames(result.tour.stops)).toEqual(['大阪', '神戶', '京都']);
  });

  it('a place only inside 【】 is not read: the shared rules drop bracketed notes with their text', () => {
    const tour = tourOf({ title: '兩天', dayLines: ['深圳關口集合 → 【江門虛構街】', '深圳解散'], days: '行程天數：2天' });
    expect(normaliseTour(tour, places, TODAY)).toMatchObject({ ok: false, reason: 'no-stops' });
  });
});

describe('parse', () => {
  it('returns null for a page it rejects', () => {
    expect(parse('<html></html>', PAGE)).toBeNull();
  });
});

interface Expected {
  sourceUrl: string; verifiedByOwner: boolean; notes: string[]; today: IsoDate;
  scraped: ScrapedTour; normalised: string; stopNames: string[]; unmatched: string[];
}
const readFixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe.each(['coach-jiangmen', 'air-egypt', 'rail-fujian', 'air-japan', 'coach-huizhou'])('taste fixture %s', name => {
  const text = readFixture(`${name}.page.json`);
  const expected: Expected = JSON.parse(readFixture(`${name}.expected.json`));
  it('parses to the hand-checked tour', () => {
    expect(parse(text, expected.sourceUrl)).toEqual(expected.scraped);
    expect(scrapedTourSchema.safeParse(expected.scraped).success).toBe(true);
  });
  it('yields the hand-checked route', () => {
    const r = normaliseTour(parse(text, expected.sourceUrl)!, places, expected.today);
    expect(r.ok ? 'ok' : r.reason).toBe(expected.normalised);
    expect(r.ok ? stopNames(r.tour.stops) : []).toEqual(expected.stopNames);
    expect(r.unmatched).toEqual(expected.unmatched);
  });
  it('every departure is without a price of its own', () => {
    expect(expected.scraped.departures.length).toBeGreaterThan(0);
    for (const departure of expected.scraped.departures) expect(departure.priceHkd).toBeNull();
  });
  it('is not yet verified by the owner', () => {
    expect(expected.verifiedByOwner).toBe(false);
    expect(expected.sourceUrl).toMatch(/^https:\/\/tastetravel\.com\.hk\/tour\/detail\/tour_id\/\d+$/);
  });
});
