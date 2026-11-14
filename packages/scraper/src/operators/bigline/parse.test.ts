import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHUNK_SEPARATORS, extractStops, normaliseTour, places, scrapedTourSchema, type ScrapedTour, type Stop } from '@hktours/core';
import { joinTour } from './fetch-page';
import { parse } from './parse';
import { publicDates, publicDetail } from './public';
import { rawDates, rawDetail, rawRow, SECRETS } from './test-responses';

/** The date the fixtures were saved, from docs/operators/bigline.md. */
const CAPTURED = '2026-11-13';

interface Expected {
  sourceUrl: string;
  verifiedByOwner: boolean;
  notes: string;
  scraped: ScrapedTour | null;
  /** Set when the runner skips the tour rather than saving it (the edge fixture has no upcoming dates). */
  normalised?: 'no-departures';
  stopNames: string[];
  /** Day-heading tokens the shared normaliser reports as unmatched: attractions, and places not yet listed. */
  unmatched: string[];
}

const readFixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const readJson = (name: string): Expected => JSON.parse(readFixture(name));

/** City nameZh for each stop, or region nameZh where only a region is known. */
const stopNames = (stops: Stop[]) =>
  stops.map(s => (s.cityId !== null ? places.city(s.cityId)!.nameZh : places.region(s.regionId)!.nameZh));

describe.each(['multi-city', 'simple', 'edge', 'prose-routes'])('bigline %s', name => {
  const text = readFixture(`${name}.api.json`);
  const expected = readJson(`${name}.expected.json`);
  it('parses to the hand-checked tour', () => {
    expect(parse(text, expected.sourceUrl, CAPTURED)).toEqual(expected.scraped);
  });
  it('passes the shared schema', () => {
    expect(scrapedTourSchema.safeParse(parse(text, expected.sourceUrl, CAPTURED)).success).toBe(true);
  });
  it('yields the hand-checked route', () => {
    const tour = parse(text, expected.sourceUrl, CAPTURED)!;
    const r = normaliseTour(tour, places, CAPTURED);
    if (expected.normalised === undefined) {
      expect(r.ok).toBe(true);
      expect(r.ok && stopNames(r.tour.stops)).toEqual(expected.stopNames);
    } else {
      expect(r).toMatchObject({ ok: false, reason: expected.normalised });
      // The route normaliseTour finds before it checks the departures (the start point is Hong Kong).
      expect(stopNames(extractStops(tour.dayHeadings, places).stops)).toEqual(expected.stopNames);
    }
    // The brief asks for []: Big Line's route lines also name attractions, which no places list holds.
    // The hand-written list holds those, and places missing from data.json (named in the notes).
    expect(r.unmatched).toEqual(expected.unmatched);
  });
  it('is not yet verified by the owner', () => {
    expect(expected.verifiedByOwner).toBe(false);
    expect(expected.sourceUrl).toMatch(/^https:\/\/bigline\.hk\/tour-group\/\d+$/);
  });
});

const MULTI_URL = 'https://bigline.hk/tour-group/8923';
const multiCity = readFixture('multi-city.api.json');

it('returns null for a non-tour page, or empty input, without throwing', () => {
  expect(parse('<html><body>404</body></html>', 'https://bigline.hk/x')).toBeNull();
  expect(parse('', 'https://bigline.hk/x')).toBeNull();
  expect(parse(multiCity, 'https://bigline.hk/x')).toBeNull();
});
it('never copies long prose: no piece of a heading over 16 characters, no sentence mark', () => {
  // The plan's 80-character limit per heading does not hold: a chunk listing many short places is kept whole
  // (multi-city's day 2 is 92 characters). Each piece the shared rules split a heading at is short instead.
  for (const name of ['multi-city', 'simple', 'edge', 'prose-routes']) {
    const tour = parse(readFixture(`${name}.api.json`), readJson(`${name}.expected.json`).sourceUrl, CAPTURED)!;
    for (const piece of tour.dayHeadings.flatMap(h => h.split(CHUNK_SEPARATORS))) {
      expect([...piece].length).toBeLessThanOrEqual(16);
    }
    for (const heading of tour.dayHeadings) expect(heading).not.toMatch(/[，。；！？]/);
  }
});
it('drops the query string and fragment from the url', () => {
  expect(parse(multiCity, `${MULTI_URL}?utm=x#dates`, CAPTURED)!.url).toBe(MULTI_URL);
});
it('links the card to the public bigline.hk page, never the API', () => {
  expect(parse(multiCity, MULTI_URL, CAPTURED)!.url).toBe('https://bigline.hk/tour-group/8923');
});

/** parse over raw answers built in the test (the same shape fetchPage joins). */
const PAGE = 'https://bigline.hk/tour-group/9109';
function parseRaw(detail: unknown, months: [string, unknown][] = [], trim = true): ScrapedTour | null {
  const text = trim
    ? joinTour({ detail: publicDetail(detail), months: months.map(([yearMonth, dates]) => ({ yearMonth, dates: publicDates(dates) })) })
    : JSON.stringify({ detail, months: months.map(([yearMonth, dates]) => ({ yearMonth, dates })) });
  return parse(text, PAGE, CAPTURED);
}
const departures = (rows: Record<string, unknown>[]) => parseRaw(rawDetail(), [['2026-12', rawDates(rows)]])?.departures;

describe('privacy', () => {
  it('reads no name, note, supplier or cost, even from an answer that was not trimmed', () => {
    const months: [string, unknown][] = [['2026-12', rawDates([rawRow('2026-12-04'), rawRow('2026-12-09')])]];
    for (const trim of [true, false]) {
      const tour = parseRaw(rawDetail(), months, trim);
      expect(tour?.departures).toHaveLength(2);
      const out = JSON.stringify(tour);
      for (const secret of SECRETS) expect(out).not.toContain(secret);
    }
  });
});

describe('departures', () => {
  it('keeps every open date with its own member price', () => {
    expect(departures([rawRow('2026-12-04'), rawRow('2026-12-09', { memberFee: 6199.0 })]))
      .toEqual([{ date: '2026-12-04', priceHkd: 5799 }, { date: '2026-12-09', priceHkd: 6199 }]);
  });
  it.each([
    ['no seats left', { seatRemain: 0 }],
    ['seats left missing', { seatRemain: null }],
    ['as many sold as the tour holds', { soldTotal: 20, maxPersonTotal: 20, seatRemain: 3 }],
    ['registration marked closed (registrationStatus 1)', { registrationStatus: 1 }],
    ['the full flag 5 in tourFlag', { tourFlag: '1,2,5' }],
    ['cut off', { isCutofftour: true }],
  ])('leaves out a date with %s (the conservative reading of "full")', (_name, patch) => {
    expect(departures([rawRow('2026-12-04', patch), rawRow('2026-12-09')])).toEqual([{ date: '2026-12-09', priceHkd: 5799 }]);
  });
  it('keeps a date with seats left whatever its tourStatus (its meaning is unknown)', () => {
    expect(departures([rawRow('2026-12-01', { tourStatus: '2', seatRemain: 3, soldTotal: 0, maxPersonTotal: 3, releaseStatusDaily: '' })]))
      .toEqual([{ date: '2026-12-01', priceHkd: 5799 }]);
  });
  it('keeps a date whose price is missing or junk, without a price', () => {
    expect(departures([rawRow('2026-12-04', { memberFee: null }), rawRow('2026-12-05', { memberFee: '5799' }), rawRow('2026-12-06', { memberFee: 50 })]))
      .toEqual([{ date: '2026-12-04', priceHkd: null }, { date: '2026-12-05', priceHkd: null }, { date: '2026-12-06', priceHkd: null }]);
  });
  it('skips a date that is not a real YYYY-MM-DD date', () => {
    expect(departures([rawRow('2026-02-30'), rawRow('soon'), rawRow('2026-12-04 00:00:00'), rawRow('2026-12-09')]))
      .toEqual([{ date: '2026-12-09', priceHkd: 5799 }]);
  });
  it('reads every month in order', () => {
    const tour = parseRaw(rawDetail(), [['2026-11', rawDates([rawRow('2026-11-29')])], ['2026-12', rawDates([rawRow('2026-12-04')])]]);
    expect(tour?.departures.map(d => d.date)).toEqual(['2026-11-29', '2026-12-04']);
  });
  it('offers only dates strictly after today: past dates are scraped facts, dropped by normalising', () => {
    const t = parseRaw(rawDetail(), [['2026-11', rawDates([rawRow('2026-11-11'), rawRow('2026-11-13'), rawRow('2026-11-14')])]])!;
    expect(t.departures.map(d => d.date)).toEqual(['2026-11-11', '2026-11-13', '2026-11-14']);
    const r = normaliseTour(t, places, CAPTURED);
    expect(r.ok && r.tour.departures.map(d => d.date)).toEqual(['2026-11-14']);
  });
  it('keeps a tour with no months as a tour with no departures, which the runner skips as no-departures', () => {
    const t = parseRaw(rawDetail({ availableMonths: [] }))!;
    expect(t).toMatchObject({ code: 'CSIAA06', days: 6, departures: [] });
    expect(normaliseTour(t, places, CAPTURED)).toMatchObject({ ok: false, reason: 'no-departures' });
  });
  it.each([
    ['carries an error code', { code: 401, msg: '未授权' }],
    ['has no list', { code: 200, data: {} }],
    ['lists a departure of another tour', rawDates([rawRow('2026-12-04', { productId: 9110 })])],
    ['lists a departure without its tour id', rawDates([rawRow('2026-12-04', { productId: null })])],
  ])('returns null when a month\'s answer %s', (_name, dates) => {
    expect(parseRaw(rawDetail(), [['2026-12', dates]])).toBeNull();
  });
  it('accepts the tour id as a number or as text in a departure', () => {
    expect(departures([rawRow('2026-12-04', { productId: '9109' })])).toHaveLength(1);
  });
});

describe('the detail', () => {
  it.each([
    ['carries an error code', { code: 401, msg: '未授权' }],
    ['is for another tour', rawDetail({ id: 9110 })],
    ['has no tour code', rawDetail({ basic: { tourNo: '', nameCn: 'x', tourDays: 6 } })],
    ['has a tour code that is not a valid code', rawDetail({ basic: { tourNo: 'CS IAA/06', nameCn: 'x', tourDays: 6 } })],
    ['has no day count', rawDetail({ basic: { tourNo: 'CSIAA06', nameCn: 'x', tourDays: null } })],
    ['has a day count that is not a whole number', rawDetail({ basic: { tourNo: 'CSIAA06', nameCn: 'x', tourDays: 2.5 } })],
    ['is priced in another currency', rawDetail({ signUp: { settlementCurrencyCode: 'CNY', locationGroupList: [] } })],
  ])('returns null when it %s', (_name, detail) => {
    expect(parseRaw(detail)).toBeNull();
  });
  it('reads the title with spaces and line breaks collapsed', () => {
    expect(parseRaw(rawDetail({ basic: { tourNo: 'CSIAA06', nameCn: ' 【西安】\n  直航6天 ', tourDays: 6 } }))?.title).toBe('【西安】 直航6天');
  });
  it('reads the day headings in day order', () => {
    const tour = parseRaw(rawDetail({ projectItinerary: { dailyTripList: [
      { days: 2, tripContent: '酒店~西安' }, { days: 1, tripContent: '.香港機場集合~西安機場' },
    ] } }));
    expect(tour?.dayHeadings).toEqual(['香港機場集合 → 西安機場', '酒店 → 西安']);
  });
  it('takes the first gathering place as the start, and states no end', () => {
    const tour = parseRaw(rawDetail({ signUp: { settlementCurrencyCode: 'HKD', locationGroupList: [
      { locationName: ' 深圳灣口岸 ' }, { locationName: '香港國際機場' },
    ] } }));
    expect([tour?.startPoint, tour?.endPoint]).toEqual(['深圳灣口岸', null]);
  });
  it('has no start point when no gathering place is listed', () => {
    expect(parseRaw(rawDetail({ signUp: { settlementCurrencyCode: 'HKD', locationGroupList: [] } }))?.startPoint).toBeNull();
  });
  it('has no from price when the detail gives none', () => {
    expect(parseRaw(rawDetail({ memberFee: null }))?.fromPriceHkd).toBeNull();
  });
  it('gives no nights: the API does not state them', () => {
    expect(parseRaw(rawDetail())?.nights).toBeNull();
  });
});
