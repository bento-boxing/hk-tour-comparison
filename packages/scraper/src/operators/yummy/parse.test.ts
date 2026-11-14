import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractStops, normaliseTour, places, scrapedTourSchema, type ScrapedTour, type Stop } from '@hktours/core';
import { joinTour } from './fetch-page';
import { parse, readTour } from './parse';
import { publicDates, publicDetail } from './public';
import { rawDates, rawDetail, rawGroup, SECRET_COUNT, SECRETS } from './test-responses';

/** The date the fixtures' answers were captured (Hong Kong), from docs/operators/yummy.md. */
const CAPTURED = '2026-11-14';

interface Expected {
  sourceUrl: string;
  verifiedByOwner: boolean;
  notes: string;
  scraped: ScrapedTour | null;
  stopNames: string[];
  /** City-list names the shared normaliser reports as unmatched. */
  unmatched: string[];
}

const readFixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const readJson = (name: string): Expected => JSON.parse(readFixture(name));

/** City nameZh for each stop, or region nameZh where only a region is known. */
const stopNames = (stops: Stop[]) =>
  stops.map(s => (s.cityId !== null ? places.city(s.cityId)!.nameZh : places.region(s.regionId)!.nameZh));

describe.each(['simple', 'multi-city', 'edge'])('yummy %s', name => {
  const text = readFixture(`${name}.api.json`);
  const expected = readJson(`${name}.expected.json`);
  it('parses to the hand-checked tour', () => {
    expect(parse(text, expected.sourceUrl)).toEqual(expected.scraped);
  });
  it('passes the shared schema', () => {
    expect(scrapedTourSchema.safeParse(parse(text, expected.sourceUrl)).success).toBe(true);
  });
  it('yields the hand-checked route', () => {
    const r = normaliseTour(parse(text, expected.sourceUrl)!, places, CAPTURED);
    expect(r.ok).toBe(true);
    expect(r.ok && stopNames(r.tour.stops)).toEqual(expected.stopNames);
    expect(r.unmatched).toEqual(expected.unmatched);
  });
  it('is not yet verified by the owner', () => {
    expect(expected.verifiedByOwner).toBe(false);
    expect(expected.sourceUrl).toMatch(/^https:\/\/www\.yummyholiday\.net\/#\/pages\/detail\/detail\?id=\d+$/);
  });
});

/** parse over raw answers built in the test, joined as fetchPage joins them (trimmed unless `trim` is false). */
const PAGE = 'https://www.yummyholiday.net/#/pages/detail/detail?id=5906';
function read(detail: unknown, dates: unknown = rawDates([rawGroup('2026-12-10')]), trim = true) {
  const text = trim ? joinTour({ detail: publicDetail(detail), dates: publicDates(dates) }) : JSON.stringify({ detail, dates });
  return readTour(text, PAGE);
}
const tourOf = (detail: unknown, dates?: unknown): ScrapedTour => {
  const tour = read(detail, dates);
  if ('why' in tour) throw new Error(`rejected: ${tour.why}`);
  return tour;
};
const departuresOf = (groups: Record<string, unknown>[]) => tourOf(rawDetail(), rawDates(groups)).departures;

describe('the tour', () => {
  it('reads code, days, "from" price and the site\'s tour page, with no nights, start or end', () => {
    expect(tourOf(rawDetail())).toEqual({
      operatorId: 'yummy', code: 'AA-J-TD05', url: PAGE, title: '【關東巡遊】東京・富士・鎌倉古都(紅葉)溫泉五天團', days: 5,
      nights: null, dayHeadings: ['日本', '東京', '富士'], startPoint: null, endPoint: null, fromPriceHkd: 5399,
      departures: [{ date: '2026-12-10', priceHkd: 5699 }], dropRegionWithListedCity: true,
    });
  });
  it('sets no fallback route: a city list with no known place is no-stops, not read from the title', () => {
    const tour = tourOf(rawDetail({ dist_list: '日本,未知之地', name: '東京五天團' }));
    expect(tour).not.toHaveProperty('fallbackRoute');
    expect(normaliseTour(tour, places, CAPTURED)).toMatchObject({ ok: false, reason: 'no-stops', unmatched: ['未知之地'] });
  });
  it('takes the "from" price as given, never from the departures', () => {
    const tour = tourOf(rawDetail({ price: 4999 }), rawDates([rawGroup('2026-12-10', { price: 6699 })]));
    expect(tour.fromPriceHkd).toBe(4999);
    expect(tourOf(rawDetail({ price: null })).fromPriceHkd).toBeNull();
  });
  it('links the site\'s tour page, whatever else the URL carried', () => {
    expect(parse(joinTour({ detail: publicDetail(rawDetail()), dates: publicDates(rawDates([])) }), PAGE)!.url).toBe(PAGE);
  });
});

describe('the title', () => {
  it.each([
    ['name when is_website_name is 0, even with a website_name', { is_website_name: 0, website_name: '網站名' }, '原名'],
    ['website_name when is_website_name is 1 and it has text', { is_website_name: 1, website_name: ' 網站名 ' }, '網站名'],
    ['name when is_website_name is 1 but website_name is empty', { is_website_name: 1, website_name: '' }, '原名'],
    ['name when is_website_name is 1 but website_name is only spaces', { is_website_name: 1, website_name: '  ' }, '原名'],
    ['name when is_website_name is 1 but website_name is missing', { is_website_name: 1, website_name: null }, '原名'],
    ['name when is_website_name is anything but 1', { is_website_name: 2, website_name: '網站名' }, '原名'],
    ['name when is_website_name is the text "1", not the number', { is_website_name: '1', website_name: '網站名' }, '原名'],
  ])('is %s', (_name, patch, title) => {
    expect(tourOf(rawDetail({ name: '原名', ...patch })).title).toBe(title);
  });
});

describe('the route', () => {
  it('is the city list split at ASCII and full-width commas, in the operator\'s order, each name trimmed', () => {
    expect(tourOf(rawDetail({ dist_list: ' 雲南, 大理，瀘沽湖,,麗江 ，昆明 ' })).dayHeadings).toEqual(['雲南', '大理', '瀘沽湖', '麗江', '昆明']);
    expect(tourOf(rawDetail({ dist_list: '' })).dayHeadings).toEqual([]);
    expect(tourOf(rawDetail({ dist_list: null })).dayHeadings).toEqual([]);
  });
  it('gives the stops in list order, the leading country name not one of them', () => {
    const { stops } = extractStops(tourOf(rawDetail({ dist_list: '日本,大阪,京都,東京' })).dayHeadings, places);
    expect(stopNames(stops)).toEqual(['大阪', '京都', '東京']);
    const reversed = extractStops(tourOf(rawDetail({ dist_list: '日本,東京,京都,大阪' })).dayHeadings, places);
    expect(stopNames(reversed.stops)).toEqual(['東京', '京都', '大阪']);
    expect(reversed.unmatched).toEqual([]);
  });
  it('drops a province when one of its cities is listed, before or after it (owner decision 2026-11-14)', () => {
    const route = (distList: string) => {
      const r = normaliseTour(tourOf(rawDetail({ dist_list: distList })), places, CAPTURED);
      return r.ok ? stopNames(r.tour.stops) : r.reason;
    };
    expect(route('雲南,大理,瀘沽湖,麗江,昆明')).toEqual(['大理', '瀘沽湖', '麗江', '昆明']);
    expect(route('清遠,雲南,大理')).toEqual(['清遠', '大理']);
    expect(route('大理,麗江,雲南')).toEqual(['大理', '麗江']);
    expect(route('雲南,清遠')).toEqual(['雲南', '清遠']); // no city of Yunnan listed: the province stays
  });
});

describe('departures', () => {
  it('keep each date with its group\'s price, past dates included (normaliseTour drops those)', () => {
    expect(departuresOf([rawGroup('2026-11-01', { price: 5599 }), rawGroup('2026-12-10'), rawGroup('2026-12-17', { price: 8499 })]))
      .toEqual([{ date: '2026-11-01', priceHkd: 5599 }, { date: '2026-12-10', priceHkd: 5699 }, { date: '2026-12-17', priceHkd: 8499 }]);
  });
  it('drop a cancelled group (status 4): a date with only cancelled groups is not a departure', () => {
    expect(departuresOf([rawGroup('2026-12-10', { group_enroll_status: 4 }), rawGroup('2026-12-17')]))
      .toEqual([{ date: '2026-12-17', priceHkd: 5699 }]);
  });
  it('leave a cancelled group\'s price out of its date', () => {
    expect(departuresOf([rawGroup('2026-12-10', { group_enroll_status: 4, price: 999 }), rawGroup('2026-12-10', { price: 5699 })]))
      .toEqual([{ date: '2026-12-10', priceHkd: 5699 }]);
  });
  it('drop a full date (status 3)', () => {
    expect(departuresOf([rawGroup('2026-12-10', { group_enroll_status: 3 }), rawGroup('2026-12-17', { group_enroll_status: 2 })]))
      .toEqual([{ date: '2026-12-17', priceHkd: 5699 }]);
  });

  describe('of several groups on one date', () => {
    const date = (statusesAndPrices: [number, number][]) =>
      departuresOf(statusesAndPrices.map(([group_enroll_status, price]) => rawGroup('2026-12-10', { group_enroll_status, price })));
    it.each([
      ['confirmed (2) over nearly confirmed (1)', [[1, 5000], [2, 5800]], 5800],
      ['nearly confirmed (1) over taking bookings (0)', [[0, 5000], [1, 5900]], 5900],
      ['taking bookings (0) over full (3)', [[3, 5000], [0, 6000]], 6000],
      ['confirmed (2) over everything, in any order', [[0, 5100], [3, 5000], [2, 6100], [1, 5200]], 6100],
      ['the lowest price of equal statuses', [[0, 5799], [0, 5699], [0, 5899]], 5699],
      ['the lowest price of equal best statuses, ignoring a cheaper worse one', [[2, 5800], [1, 5000], [2, 5700]], 5700],
    ] as [string, [number, number][], number][])('are one departure, at the price of the group the site would show: %s', (_name, groups, price) => {
      expect(date(groups)).toEqual([{ date: '2026-12-10', priceHkd: price }]);
    });
    it('are full only when every group left is full', () => {
      expect(date([[3, 5599], [3, 5599]])).toEqual([]);
      expect(date([[3, 5599], [4, 5599]])).toEqual([]); // full, and the other cancelled
      expect(date([[4, 5599], [4, 5599]])).toEqual([]); // all cancelled
      expect(date([[3, 5599], [2, 5599]])).toEqual([{ date: '2026-12-10', priceHkd: 5599 }]);
    });
  });

  it.each([
    ['status 5', 5], ['status -1', -1], ['status as text', '0'], ['no status', null], ['a fractional status', 1.5],
  ])('make the tour a parse failure for an unknown group status (%s), not a guess', (_name, status) => {
    const tour = read(rawDetail(), rawDates([rawGroup('2026-12-10'), rawGroup('2026-12-17', { group_enroll_status: status })]));
    expect(tour).toEqual({ why: 'a group has an unknown status (not 0 to 4)' });
  });
  it('skip a group without a real date', () => {
    expect(departuresOf([rawGroup('2026-02-30'), rawGroup('soon'), rawGroup('2026-12-10')])).toEqual([{ date: '2026-12-10', priceHkd: 5699 }]);
  });
  it('have no price when the group gives none', () => {
    expect(departuresOf([rawGroup('2026-12-10', { price: null })])).toEqual([{ date: '2026-12-10', priceHkd: null }]);
  });
});

describe('a page the parser rejects', () => {
  const joined = (detail: unknown, dates: unknown = rawDates([])) => joinTour({ detail: publicDetail(detail), dates: publicDates(dates) });
  it.each([
    ['not the joined text', '<html></html>', PAGE, 'not the joined detail and dates text'],
    ['not a tour page', joined(rawDetail()), 'https://www.yummyholiday.net/#/pages/content/content?id=7', 'not a Yummy Holiday tour page'],
    ['an error code on the detail', joined({ code: 0, msg: 'x' }), PAGE, 'the detail answered a code other than 1'],
    ['another tour\'s detail', joined(rawDetail({ id: 5907 })), PAGE, 'the detail is for another tour'],
    ['no valid code', joined(rawDetail({ code: 'AA J' })), PAGE, 'the detail has no valid tour code'],
    ['no day count', joined(rawDetail({ daycount: '5' })), PAGE, 'the detail has no day count of at least 1'],
    ['a zero day count', joined(rawDetail({ daycount: 0 })), PAGE, 'the detail has no day count of at least 1'],
    ['an error code on the dates', joined(rawDetail(), { code: 0 }), PAGE, 'the dates answered a code other than 1, or no list'],
    ['dates with no list', joined(rawDetail(), { code: 1, data: {} }), PAGE, 'the dates answered a code other than 1, or no list'],
  ])('is rejected with its reason (%s)', (_name, text, url, why) => {
    expect(readTour(text, url)).toEqual({ why });
    expect(parse(text, url)).toBeNull();
  });
  it('never puts the answer\'s text in the reason', () => {
    expect(read(rawDetail({ code: SECRETS[0] }))).toEqual({ why: 'the detail has no valid tour code' });
  });
});

describe('privacy', () => {
  it('reads no prose, image or PDF path or booking count, even from an answer that was not trimmed', () => {
    for (const trim of [true, false]) {
      const tour = read(rawDetail(), rawDates([rawGroup('2026-12-10'), rawGroup('2026-12-17')]), trim);
      expect('why' in tour).toBe(false);
      const out = JSON.stringify(tour);
      for (const secret of SECRETS) expect(out).not.toContain(secret);
      expect(out).not.toContain(String(SECRET_COUNT));
    }
  });
});
