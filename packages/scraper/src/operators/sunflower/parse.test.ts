import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  normaliseStartPoint, normaliseTour, places, scrapedTourSchema,
  type IsoDate, type ScrapedTour, type Stop,
} from '@hktours/core';
import { joinPage } from './fetch-page';
import { laterDates, parse, readTour } from './parse';
import { publicBookingPage, publicEntry } from './public';
import { rawBookingPage, rawListingRow, type RawCell } from './test-responses';

const TODAY = '2026-11-14';
const PAGE = 'https://www.sunflower.com.hk/OnlineBooking/?TourCode=KKFE05WR';

/** readTour over a listing entry and a booking page built in the test, joined as fetchPage joins them. */
function read(row: Record<string, unknown> = rawListingRow('KKFE05WR'), html = rawBookingPage(), today: IsoDate = TODAY, url = PAGE) {
  return readTour(joinPage({ today, entry: publicEntry(row), page: publicBookingPage(html) }), url);
}
function tourOf(row?: Record<string, unknown>, html?: string, today?: IsoDate): ScrapedTour {
  const tour = read(row, html, today);
  if ('why' in tour) throw new Error(`rejected: ${tour.why}`);
  return tour;
}
const row = (overrides: Record<string, unknown>, code = 'KKFE05WR') => rawListingRow(code, overrides);
const page = (opts: Parameters<typeof rawBookingPage>[0]) => rawBookingPage(opts);
const stopNames = (stops: Stop[]) =>
  stops.map(s => (s.cityId !== null ? places.city(s.cityId)!.nameZh : places.region(s.regionId)!.nameZh));

describe('the tour', () => {
  it('reads code, title, days, the "from" price and the booking page as its link, with no nights or itinerary', () => {
    expect(tourOf()).toEqual({
      operatorId: 'sunflower', code: 'KKFE05WR', url: PAGE, title: '暢遊冬日秘境釜山慶州食足13餐五天團', days: 5, nights: null,
      dayHeadings: ['釜山', '慶州'], fallbackRoute: ['韓國', '暢遊冬日秘境釜山慶州食足13餐五天團'], startPoint: null, endPoint: null, fromPriceHkd: 2699,
      departures: [{ date: '2026-12-01', priceHkd: 2999 }, { date: '2027-01-06', priceHkd: null }],
      dropRegionWithListedCity: true,
    });
  });

  it('passes the shared schema', () => {
    expect(scrapedTourSchema.safeParse(tourOf()).success).toBe(true);
  });

  it('takes the days only from the booking page\'s #Content_lbtnday tag, never from the code', () => {
    expect(tourOf(undefined, page({ days: '#12天團' })).days).toBe(12);
    expect(read(undefined, page({ days: null }))).toEqual({ why: 'the booking page has no day count (#Content_lbtnday)' });
    expect(read(undefined, page({ days: '#天團' }))).toEqual({ why: 'the booking page has no day count (#Content_lbtnday)' });
  });

  it('is rejected without the calendar\'s month heading', () => {
    expect(read(undefined, page({ month: null }))).toEqual({ why: 'the booking page has no calendar month' });
  });

  it('is rejected when the listing entry is for another tour than the page', () => {
    expect(read(row({}, 'CFAG03MK'))).toEqual({ why: 'the listing entry is for another tour' });
    expect(readTour('<html></html>', PAGE)).toEqual({ why: 'not the joined listing entry and booking page' });
    expect(read(undefined, undefined, TODAY, 'https://www.sunflower.com.hk/tourpdf/KKFE05WR.pdf')).toEqual({ why: 'not a Sunflower booking page' });
  });

  it('removes any HTML from the title, keeping angle-bracketed words that are not tags', () => {
    expect(tourOf(row({ Title: '遊兩大直轄市~京津 5 日純玩團 <皇城根下尋古韻>' })).title).toBe('遊兩大直轄市~京津 5 日純玩團 <皇城根下尋古韻>');
    expect(tourOf(row({ Title: '韓國<br>首爾 &amp; 仁川 <b>5天</b>' })).title).toBe('韓國 首爾 & 仁川 5天');
  });
});

describe('the "from" price', () => {
  it('is the discounted price when the listing gives one', () => {
    expect(tourOf(row({ minprice: 3299, discount: 2699, discounttext: '2,699' })).fromPriceHkd).toBe(2699);
    expect(tourOf(row({ minprice: 3299, discount: null, discounttext: '2,699' })).fromPriceHkd).toBe(2699);
  });
  it('is minprice otherwise', () => {
    expect(tourOf(row({ minprice: 3299, discount: 0, discounttext: '' })).fromPriceHkd).toBe(3299);
    expect(tourOf(row({ minprice: 3299, discount: null, discounttext: null })).fromPriceHkd).toBe(3299);
  });
  it('is null when neither is a price (under HK$100)', () => {
    expect(tourOf(row({ minprice: 99, discount: 99, discounttext: '99' })).fromPriceHkd).toBeNull();
  });
});

describe('departures in the month the calendar shows', () => {
  const cells: RawCell[] = [
    { date: '20261201', price: '$2,999起' },
    { date: '20261202', status: '-H', price: '$2,699起' },
    { date: '20261204', status: '-G', price: '$2,799起' },
    { date: '20261225', status: '-H', holiday: true, price: '$5,099起' },
    { date: '20261219', status: '-H', price: '<p class="dollarsign">$</p>2,999+' },
    { status: '-F', price: '$5,399起' }, // 額滿: no date link
    { date: '20261229', status: '-F', price: '$5,399起' }, // 額滿 with a date link: still left out, by its class
    { date: '20261230', price: '' },
  ];
  it('are every available cell with its date link and its price, whatever its status class', () => {
    expect(tourOf(row({ tdp_confirm: '', tdp_hardpush: '' }), page({ cells })).departures).toEqual([
      { date: '2026-12-01', priceHkd: 2999 },
      { date: '2026-12-02', priceHkd: 2699 },
      { date: '2026-12-04', priceHkd: 2799 },
      { date: '2026-12-19', priceHkd: 2999 },
      { date: '2026-12-25', priceHkd: 5099 },
      { date: '2026-12-30', priceHkd: null },
    ]);
  });
});

describe('later dates from the listing', () => {
  it('are the listed dates outside the shown month, with no price of their own', () => {
    const tour = tourOf(row({ tdp_confirm: '4/12,11/12,3/1', tdp_hardpush: '2/12,25/3,3/1...' }), page({ month: '2026年12月' }));
    expect(tour.departures).toEqual([
      { date: '2026-12-01', priceHkd: 2999 },
      { date: '2027-01-03', priceHkd: null },
      { date: '2027-03-25', priceHkd: null },
    ]);
  });

  it('do not repeat a date of the shown month, even one the calendar does not list', () => {
    const tour = tourOf(row({ tdp_confirm: '1/12,5/12', tdp_hardpush: '' }), page({ cells: [{ date: '20261201', price: '$2,999起' }] }));
    expect(tour.departures).toEqual([{ date: '2026-12-01', priceHkd: 2999 }]);
  });

  it('are kept when the calendar shows no departure', () => {
    expect(tourOf(row({ tdp_confirm: '', tdp_hardpush: '5/12' }), page({ month: '2026年11月', cells: [] })).departures)
      .toEqual([{ date: '2026-12-05', priceHkd: null }]);
  });
});

describe('the year of a listed D/M date', () => {
  it('is the first date on or after today with that day and month, across the year end; today itself is kept', () => {
    expect(laterDates('20/11,14/11,2/1,31/12', '2026-11-14')).toEqual(['2026-11-20', '2026-11-14', '2027-01-02', '2026-12-31']);
    expect(laterDates('5/1', '2026-12-20')).toEqual(['2027-01-05']);
  });
  it('drops a date that has just passed instead of moving it a year on (more than 335 days ahead)', () => {
    expect(laterDates('13/11', '2026-11-14')).toEqual([]);  // yesterday: 2027-11-13 would be 364 days ahead
    expect(laterDates('16/10', '2026-11-14')).toEqual([]);  // 29 days past: 336 days ahead
    expect(laterDates('15/10', '2027-11-14')).toEqual([]);  // 30 days past, across 29 February 2028: 336 days ahead
  });
  it('keeps a date 335 days ahead and drops one 336 days ahead', () => {
    expect(laterDates('15/10', '2026-11-14')).toEqual(['2027-10-15']); // 335 days (also 30 days past: the boundary)
    expect(laterDates('16/10', '2026-11-14')).toEqual([]);              // 336 days
  });
  it('drops a date that is not a real calendar date, and ignores the trailing ... and any other text', () => {
    expect(laterDates('31/4,0/1,1/13,30/2,abc,,1/12/2026,5/12...', '2026-11-14')).toEqual(['2026-12-05']);
    expect(laterDates('...', '2026-11-14')).toEqual([]);
    expect(laterDates(null, '2026-11-14')).toEqual([]);
  });
  it('resolves 29 February to the next leap year, kept only within 335 days', () => {
    expect(laterDates('29/2', '2026-11-14')).toEqual([]);             // 2028-02-29 is 472 days ahead
    expect(laterDates('29/2', '2027-11-14')).toEqual(['2028-02-29']); // 107 days
    expect(laterDates('29/2', '2027-04-01')).toEqual(['2028-02-29']); // 334 days
    expect(laterDates('29/2', '2027-03-30')).toEqual([]);             // 336 days
    expect(laterDates('29/2', '2028-02-29')).toEqual(['2028-02-29']); // today
  });
});

describe('the route', () => {
  const normalised = (overrides: Record<string, unknown>, code = 'KKFE05WR') => {
    const tour = tourOf(row(overrides, code));
    return normaliseTour({ ...tour, code, url: tour.url }, places, TODAY);
  };

  it('is the subarea, split on 、, commas and the middle dots, through the shared place matching', () => {
    expect(tourOf(row({ subarea: '青島‧泰安．曲阜,煙臺，蓬萊、青州' })).dayHeadings).toEqual(['青島', '泰安', '曲阜', '煙臺', '蓬萊', '青州']);
    const r = normalised({ subarea: '青島‧泰安、曲阜', area: '山東', region: '中國長線' });
    expect(r.ok && stopNames(r.tour.stops)).toEqual(['青島', '泰安', '曲阜']);
  });

  it('drops a province listed beside one of its own cities, but keeps a province alone or beside another\'s city', () => {
    const r = normalised({ subarea: '廣西、桂林', area: '廣西．桂林', region: '中國長線' });
    expect(r.ok && stopNames(r.tour.stops)).toEqual(['桂林']);
    const tibet = normalised({ subarea: '西藏、成都', area: '西藏、青藏高原', region: '中國長線' });
    expect(tibet.ok && stopNames(tibet.tour.stops)).toEqual(['西藏', '成都']);
  });

  it('reads a compatibility ideograph as its ordinary character (峇里島 with U+F9E9)', () => {
    const r = normalised({ subarea: '峇里島', area: '印尼', region: '東南亞' });
    expect(r.ok && stopNames(r.tour.stops)).toEqual(['峇里島']);
  });

  it('falls back to the area where nothing in the subarea is recognised', () => {
    const r = normalised({ subarea: '環島遊', area: '台灣', region: '台灣', Title: '環島遊5天' });
    expect(r.ok).toBe(false); // 台灣 is a country: no stop
    const area = normalised({ subarea: '北疆', area: '新疆', region: '中國長線' });
    expect(area.ok && stopNames(area.tour.stops)).toEqual(['新疆']);
    expect(area.unmatched).toEqual(['北疆']); // the subarea's word is reported, the area's are not
  });

  it('reads the title as a last resort, brackets and marks as spaces, under the title rules (owner decision 2026-11-15)', () => {
    const tour = tourOf(row({ subarea: '華川', area: '韓國', region: '日韓', Title: '【5天 首爾】華川山川魚節' }));
    expect([tour.dayHeadings, tour.fallbackRoute]).toEqual([['華川'], ['韓國', '5天 首爾 華川山川魚節']]);
    const r = normalised({ subarea: '華川', area: '韓國', region: '日韓', Title: '【5天 首爾】華川山川魚節' });
    expect(r.ok && stopNames(r.tour.stops)).toEqual(['首爾']);
    expect(r.unmatched).toEqual(['華川']); // the subarea's word is reported, the title's are not
  });

  it('does not read the title while the subarea or the area gives a stop', () => {
    const r = normalised({ subarea: '北疆', area: '新疆', region: '中國長線', Title: '烏魯木齊 喀什10天' });
    expect(r.ok && stopNames(r.tour.stops)).toEqual(['新疆']);
  });

  it('has no stops where none of them names a place, and never uses the region', () => {
    const r = normalised({ subarea: '長江三峽', area: '長江三峽', region: '中國長線', Title: '長江三峽遊輪7天' });
    expect(r).toMatchObject({ ok: false, reason: 'no-stops' });
    expect(normalised({ subarea: '', area: '', region: '日本', Title: '賞楓5天' })).toMatchObject({ ok: false, reason: 'no-stops' });
    expect(tourOf(row({ subarea: '', area: '  ', Title: '' }))).not.toHaveProperty('fallbackRoute');
  });
});

describe('the route of a Guangdong short trip (owner decision 2026-11-14)', () => {
  const at = (code: string) => `https://www.sunflower.com.hk/OnlineBooking/?TourCode=${code}`;
  const guangdong = (code: string, overrides: Record<string, unknown>) => {
    const tour = readTour(joinPage({
      today: TODAY,
      entry: publicEntry(row({ region: '中國短線', area: '廣東省', subarea: '廣州、中山、深圳', ...overrides }, code)),
      page: publicBookingPage(page({ code })),
    }), at(code));
    if ('why' in tour) throw new Error(tour.why);
    return { tour, r: normaliseTour(tour, places, TODAY) };
  };

  it('is read from the title, inside its brackets, before the subarea, and its other words are not reported', () => {
    const { tour, r } = guangdong('CFAG03MK', { Title: '【3天金秋韶關賞銀杏紅葉純玩美食團】 旺角集散' });
    expect(tour.dayHeadings).toEqual([]);
    expect(tour.fallbackRoute).toEqual(['3天金秋韶關賞銀杏紅葉純玩美食團 旺角集散', '廣州、中山、深圳', '廣東省']);
    expect(r.ok && stopNames(r.tour.stops)).toEqual(['韶關']);
    expect(r.unmatched).toEqual([]);
  });

  it('keeps every place the title names in separate words', () => {
    const { r } = guangdong('CFXF03SP', { Title: '【3天 直航船 珠海 中山 江門 聖誕美食團】【赤坎古鎮賞非遺鐵火秀】' });
    expect(r.ok && stopNames(r.tour.stops)).toEqual(['珠海', '中山', '江門']);
  });

  it('falls back to the subarea, then the area, when the title names no place', () => {
    const subarea = guangdong('CFPS02MK', { Title: '溫泉美食2天純玩團 旺角集散' });
    expect(subarea.r.ok && stopNames(subarea.r.tour.stops)).toEqual(['廣州', '中山', '深圳']);
    const area = guangdong('CFPS02MK', { Title: '溫泉2天純玩團', subarea: '', area: '澳門' });
    expect(area.r.ok && stopNames(area.r.tour.stops)).toEqual(['澳門']);
  });

  it('falls through to the subarea when the title rules drop every place it names', () => {
    const { r } = guangdong('CFXX03SP', { Title: '廣東小香格里拉 東方威尼斯3天' });
    expect(r.ok && stopNames(r.tour.stops)).toEqual(['廣州', '中山', '深圳']);
    expect(r).toMatchObject({ fallbackDropped: [{ name: '香格里拉', rule: 'comparison' }, { name: '威尼斯', rule: 'comparison' }] });
  });

  it('a border day trip to Shenzhen visits Shenzhen', () => {
    const { r } = guangdong('CFQQ02LW', { Title: '2天深圳純玩團 關口集散' });
    expect(r.ok && stopNames(r.tour.stops)).toEqual(['深圳']);
  });

  it('a border tour leaves Shenzhen out when the title names another place too', () => {
    const { r } = guangdong('CFQQ02LW', { Title: '2天深圳 東莞純玩團 關口集散' });
    expect(r.ok && stopNames(r.tour.stops)).toEqual(['東莞']);
  });

  it('is read title first only for Guangdong short trips; elsewhere the title is the last resort', () => {
    const tour = tourOf(row({ region: '日韓', Title: '首爾5天', subarea: '釜山', area: '韓國' }));
    expect([tour.dayHeadings, tour.fallbackRoute]).toEqual([['釜山'], ['韓國', '首爾5天']]);
  });
});

describe('the gathering point', () => {
  const pointOf = (code: string, region = '中國短線') => {
    const tour = tourOf(row({ region }, code), page({ code }), TODAY);
    return { start: tour.startPoint, end: tour.endPoint, kind: normaliseStartPoint(tour.startPoint, places).kind };
  };
  const at = (code: string) => `https://www.sunflower.com.hk/OnlineBooking/?TourCode=${code}`;
  const tourAt = (code: string, region: string) => {
    const tour = readTour(joinPage({ today: TODAY, entry: publicEntry(row({ region }, code)), page: publicBookingPage(page({ code })) }), at(code));
    if ('why' in tour) throw new Error(tour.why);
    return tour;
  };

  it('is the border checkpoint (Shenzhen) for a Guangdong coach tour coded LW', () => {
    const tour = tourAt('CFAG03LW', '中國短線');
    expect([tour.startPoint, tour.endPoint]).toEqual(['深圳關口', '深圳關口']);
    expect(normaliseStartPoint(tour.startPoint, places).kind).toBe('sz');
  });
  it.each([['CFAG03MK', '香港旺角'], ['CFAG03TO', '香港將軍澳'], ['CFAG03YL', '香港元朗']])('is Hong Kong for %s', (code, text) => {
    const tour = tourAt(code, '中國短線');
    expect([tour.startPoint, tour.endPoint]).toEqual([text, text]);
    expect(normaliseStartPoint(tour.startPoint, places)).toEqual({ kind: 'hk', label: null });
  });
  it('is none for other codes and other regions', () => {
    expect(tourAt('CFSS02SP', '中國短線').startPoint).toBeNull();
    expect(tourAt('LKZA08MK', '中國長線').startPoint).toBeNull();
    expect(pointOf('KKFE05WR', '日韓').start).toBeNull();
  });
});

describe('parse', () => {
  it('returns null for a page it rejects', () => {
    expect(parse('<html></html>', PAGE)).toBeNull();
  });
});

interface Expected {
  sourceUrl: string; verifiedByOwner: boolean; notes: string[];
  scraped: ScrapedTour; stopNames: string[]; unmatched: string[]; normalised: string;
}
const readFixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe.each(['air-korea', 'coach-mongkok', 'china-long-haul', 'long-haul', 'taiwan'])('sunflower fixture %s', name => {
  const text = readFixture(`${name}.page.json`);
  const expected: Expected = JSON.parse(readFixture(`${name}.expected.json`));
  it('parses to the hand-checked tour', () => {
    expect(parse(text, expected.sourceUrl)).toEqual(expected.scraped);
    expect(scrapedTourSchema.safeParse(expected.scraped).success).toBe(true);
  });
  it('yields the hand-checked route', () => {
    const r = normaliseTour(parse(text, expected.sourceUrl)!, places, TODAY);
    expect(r.ok ? 'ok' : r.reason).toBe(expected.normalised);
    expect(r.ok ? stopNames(r.tour.stops) : []).toEqual(expected.stopNames);
    expect(r.unmatched).toEqual(expected.unmatched);
  });
  it('is not yet verified by the owner', () => {
    expect(expected.verifiedByOwner).toBe(false);
    expect(expected.sourceUrl).toMatch(/^https:\/\/www\.sunflower\.com\.hk\/OnlineBooking\/\?TourCode=[A-Z0-9]+$/);
  });
});
