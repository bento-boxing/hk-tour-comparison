import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { IsoDate, NormalisedTour, OperatorId, ScrapedDeparture, Stop } from '@hktours/core';
import type { Db } from './db';
import { createTestDb } from './test-db';
import { recordFailedRun, saveOperatorRun, type RunStats } from './save-run';
import {
  searchTours, getToursByKeys, getOperators, PAGE_SIZE,
  type SortKey, type TourCardData, type TourFilters,
} from './search';

const today: IsoDate = '2026-11-12';
const RUN_FINISHED = '2026-11-12T18:42:17.123Z';
const EGL_SECOND_RUN_FINISHED = '2026-11-12T19:05:00.456Z';

const stats = (finishedAt: string): RunStats => ({
  startedAt: new Date('2026-11-12T18:00:00.000Z'),
  finishedAt: new Date(finishedAt),
  pagesFetched: 10,
  parseFailures: 0,
});

const OSAKA: Stop = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' };
const KYOTO: Stop = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-kyoto' };
const NARA: Stop = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-nara' };
const TOKYO: Stop = { countryId: 'japan', regionId: 'japan-kanto', cityId: 'japan-kanto-tokyo' };
const HAKONE: Stop = { countryId: 'japan', regionId: 'japan-kanto', cityId: 'japan-kanto-hakone' };
const SEOUL: Stop = { countryId: 'korea', regionId: 'korea-seoul', cityId: 'korea-seoul-seoul' };
const NAMI: Stop = { countryId: 'korea', regionId: 'korea-seoul', cityId: 'korea-seoul-nami-island' };
const NAGOYA: Stop = { countryId: 'japan', regionId: 'japan-chubu', cityId: 'japan-chubu-nagoya' };
const TAIPEI: Stop = { countryId: 'taiwan', regionId: 'taiwan-north', cityId: 'taiwan-north-taipei' };
const JIUFEN: Stop = { countryId: 'taiwan', regionId: 'taiwan-north', cityId: 'taiwan-north-jiufen' };
const HOKKAIDO: Stop = { countryId: 'japan', regionId: 'japan-hokkaido', cityId: null };
const SAPPORO: Stop = { countryId: 'japan', regionId: 'japan-hokkaido', cityId: 'japan-hokkaido-sapporo' };

function tour(
  operatorId: OperatorId, code: string, stops: Stop[], days: number,
  departures: ScrapedDeparture[], fromPriceHkd: number,
): NormalisedTour {
  return {
    operatorId, code, url: `https://example.test/${operatorId}/${code}`, title: `${code} 團`,
    days, nights: days - 1, stops,
    start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
    fromPriceHkd, departures,
  };
}

const KIX5 = tour('egl', 'KIX5', [OSAKA, KYOTO, NARA], 5,
  [{ date: '2026-12-18', priceHkd: 7999 }, { date: '2026-12-27', priceHkd: 8999 }], 7999);
const OLD = tour('egl', 'OLD', [OSAKA], 3, [{ date: '2026-12-01', priceHkd: 3000 }], 3000);
const TYO_KIX = tour('jetour', 'TYO-KIX', [TOKYO, HAKONE, OSAKA], 6, [{ date: '2026-12-20', priceHkd: 9880 }], 9880);
const HKD7 = tour('jetour', 'HKD7', [HOKKAIDO, SAPPORO], 7, [{ date: '2027-01-05', priceHkd: 12500 }], 12500);
const SEL5: NormalisedTour = {
  ...tour('texpert', 'SEL5', [SEOUL, NAMI], 5,
    [{ date: '2026-12-24', priceHkd: 5699 }, { date: '2026-12-25', priceHkd: null }], 5699),
  start: { kind: 'other', label: '深圳灣' }, end: { kind: 'sz', label: null }, nights: null,
};
const TPE4 = tour('bigline', 'TPE4', [TAIPEI, JIUFEN], 4, [{ date: '2026-12-23', priceHkd: 3980 }], 3980);

async function save(db: Db, operatorId: OperatorId, tours: NormalisedTour[], finishedAt = RUN_FINISHED) {
  await saveOperatorRun(db, { operatorId, runDate: today, tours, unmatched: [], stats: stats(finishedAt) });
}

/** The seed table of the task brief. */
async function seed(db: Db): Promise<void> {
  await save(db, 'egl', [KIX5, OLD]);
  await save(db, 'egl', [KIX5], EGL_SECOND_RUN_FINISHED); // egl:OLD becomes inactive
  await save(db, 'jetour', [TYO_KIX, HKD7]);
  await save(db, 'texpert', [SEL5]);
  await save(db, 'bigline', [TPE4]);
  await db.query(
    `insert into price_snapshots (tour_id, date, price_hkd)
     select id, '2026-11-05', 8499 from tours where operator_id = 'egl' and code = 'KIX5'`,
  );
}

/** A Db that counts the queries made through it. */
function countingDb(inner: Db): { db: Db; count: () => number } {
  let n = 0;
  const db: Db = {
    query: (sql, params) => { n++; return inner.query(sql, params); },
    transaction: fn => inner.transaction(fn),
    exec: sql => inner.exec(sql),
    close: () => inner.close(),
  };
  return { db, count: () => n };
}

describe('on the seed table', () => {
  let db: Db;
  beforeAll(async () => { db = await createTestDb(); await seed(db); });
  afterAll(async () => { await db.close(); });

  const keys = async (filters: TourFilters, sort: SortKey = 'price') =>
    (await searchTours(db, { filters, sort, page: 1, today })).tours.map(t => t.key);

  it('returns active tours with upcoming departures, cheapest first', async () => {
    expect(await keys({})).toEqual(['bigline:TPE4', 'texpert:SEL5', 'egl:KIX5', 'jetour:TYO-KIX', 'jetour:HKD7']);
  });

  it('destination matches a first, intermediate or last stop', async () => {
    expect(await keys({ destination: { countryId: 'japan', regionId: 'japan-kansai' } })).toEqual(['egl:KIX5', 'jetour:TYO-KIX']);
  });

  it('country-wide destination', async () => {
    expect(await keys({ destination: { countryId: 'japan', regionId: null } })).toEqual(['egl:KIX5', 'jetour:TYO-KIX', 'jetour:HKD7']);
  });

  it('matches a region-only stop', async () => {
    expect(await keys({ destination: { countryId: 'japan', regionId: 'japan-hokkaido' } })).toEqual(['jetour:HKD7']);
  });

  it('excludes countries', async () => {
    expect(await keys({ excludeCountryIds: ['japan'] })).toEqual(['bigline:TPE4', 'texpert:SEL5']);
    expect(await keys({ excludeCountryIds: ['japan', 'korea'] })).toEqual(['bigline:TPE4']);
    expect(await keys({ excludeCountryIds: [] })).toHaveLength(5);
  });

  it('date window keeps only departures inside it and reprices', async () => {
    const r = await searchTours(db, { filters: { dateFrom: '2026-12-24', dateTo: '2026-12-27' }, sort: 'price', page: 1, today });
    expect(r.tours.map(t => t.key)).toEqual(['texpert:SEL5', 'egl:KIX5']);
    const kix = r.tours[1];
    expect(kix.departures).toEqual([{ date: '2026-12-27', priceHkd: 8999 }]);
    expect(kix.windowPriceHkd).toBe(8999);
    expect(kix.fromPriceHkd).toBe(7999);
  });

  it('a departure dated today is not upcoming: a tour whose only departure is today is hidden', async () => {
    const r = await searchTours(db, { filters: {}, sort: 'price', page: 1, today: '2026-12-23' });
    expect(r.tours.map(t => [t.key, t.departures.map(d => d.date)])).toEqual([
      ['texpert:SEL5', ['2026-12-24', '2026-12-25']],
      ['egl:KIX5', ['2026-12-27']],
      ['jetour:HKD7', ['2027-01-05']],
    ]);
    expect(r.total).toBe(3);
    expect(r.tours[1].fromPriceHkd).toBe(8999); // the 7999 departure (12-18) has gone
  });

  it('a window starting today starts tomorrow', async () => {
    const r = await searchTours(db, { filters: { dateFrom: '2026-12-24', dateTo: '2026-12-25' }, sort: 'price', page: 1, today: '2026-12-24' });
    expect(r.tours.map(t => [t.key, t.departures, t.windowPriceHkd])).toEqual([
      ['texpert:SEL5', [{ date: '2026-12-25', priceHkd: null }], 5699],
    ]);
  });

  it('getToursByKeys leaves out a departure dated today, and a tour whose last departure is today', async () => {
    const m = await getToursByKeys(db, ['egl:KIX5', 'texpert:SEL5'], '2026-12-24');
    expect(m.get('texpert:SEL5')!.departures).toEqual([{ date: '2026-12-25', priceHkd: null }]);
    expect([...(await getToursByKeys(db, ['egl:KIX5'], '2026-12-27')).keys()]).toEqual([]);
  });

  it('a window lower bound before today starts after today', async () => {
    const r = await searchTours(db, { filters: { dateFrom: '2026-01-01' }, sort: 'price', page: 1, today: '2026-12-26' });
    expect(r.tours.map(t => [t.key, t.departures.map(d => d.date)])).toEqual([
      ['egl:KIX5', ['2026-12-27']],
      ['jetour:HKD7', ['2027-01-05']],
    ]);
  });

  it('a null departure price falls back to the tour from-price', async () => {
    const r = await searchTours(db, { filters: { dateFrom: '2026-12-25', dateTo: '2026-12-25' }, sort: 'price', page: 1, today });
    expect(r.tours.map(t => [t.key, t.windowPriceHkd])).toEqual([['texpert:SEL5', 5699]]);
  });

  it('length, price and operator filters', async () => {
    expect(await keys({ daysMin: 5, daysMax: 5 })).toEqual(['texpert:SEL5', 'egl:KIX5']);
    expect(await keys({ daysMin: 6 })).toEqual(['jetour:TYO-KIX', 'jetour:HKD7']);
    expect(await keys({ priceMin: 5000, priceMax: 8000 })).toEqual(['texpert:SEL5', 'egl:KIX5']);
    expect(await keys({ priceMax: 3980 })).toEqual(['bigline:TPE4']);
    expect(await keys({ operators: ['jetour'] })).toEqual(['jetour:TYO-KIX', 'jetour:HKD7']);
    expect(await keys({ operators: [] })).toHaveLength(5);
  });

  it('price filters apply to the window price', async () => {
    // Inside 12-27 … 12-31 egl:KIX5 costs 8999, above priceMax although its from-price is 7999.
    expect(await keys({ dateFrom: '2026-12-27', dateTo: '2026-12-31', priceMax: 8000 })).toEqual([]);
    expect(await keys({ dateFrom: '2026-12-27', dateTo: '2026-12-31', priceMin: 8999 })).toEqual(['egl:KIX5']);
  });

  it('sorts', async () => {
    expect(await keys({}, 'days')).toEqual(['bigline:TPE4', 'texpert:SEL5', 'egl:KIX5', 'jetour:TYO-KIX', 'jetour:HKD7']);
    expect(await keys({}, 'date')).toEqual(['egl:KIX5', 'jetour:TYO-KIX', 'bigline:TPE4', 'texpert:SEL5', 'jetour:HKD7']);
    // by FIRST stop: japan-hokkaido, japan-kansai, japan-kanto, korea-seoul, taiwan-north
    expect(await keys({}, 'destination')).toEqual(['jetour:HKD7', 'egl:KIX5', 'jetour:TYO-KIX', 'texpert:SEL5', 'bigline:TPE4']);
  });

  it('date sort uses the earliest departure inside the window', async () => {
    // From 12-21 on, egl:KIX5's first listed departure is 12-27, after bigline 12-23 and texpert 12-24.
    expect(await keys({ dateFrom: '2026-12-21' }, 'date')).toEqual(['bigline:TPE4', 'texpert:SEL5', 'egl:KIX5', 'jetour:HKD7']);
  });

  it('hides tours whose departures have all passed', async () => {
    const r = await searchTours(db, { filters: {}, sort: 'price', page: 1, today: '2026-12-26' });
    expect(r.tours.map(t => t.key)).toEqual(['egl:KIX5', 'jetour:HKD7']);
    expect(r.total).toBe(2);
  });

  it('never returns inactive tours', async () => {
    expect(await keys({})).not.toContain('egl:OLD');
    expect(await keys({ operators: ['egl'], dateTo: '2026-12-01' })).toEqual([]);
  });

  it('includes the 7-day price change', async () => {
    const kix = (await searchTours(db, { filters: { operators: ['egl'] }, sort: 'price', page: 1, today })).tours[0];
    expect(kix.priceChange).toEqual({ kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' });
  });

  it('a tour without a week-old snapshot has no price change', async () => {
    const tpe = (await searchTours(db, { filters: { operators: ['bigline'] }, sort: 'price', page: 1, today })).tours[0];
    expect(tpe.priceChange).toBeNull();
  });

  it('a card carries every field, with the operator freshness as an ISO UTC timestamp', async () => {
    const r = await searchTours(db, { filters: { operators: ['texpert'] }, sort: 'price', page: 1, today });
    expect(r).toEqual({
      total: 1,
      tours: [{
        key: 'texpert:SEL5', operatorId: 'texpert', url: 'https://example.test/texpert/SEL5', title: 'SEL5 團',
        days: 5, nights: null,
        stops: [SEOUL, NAMI],
        start: { kind: 'other', label: '深圳灣' }, end: { kind: 'sz', label: null },
        fromPriceHkd: 5699, windowPriceHkd: 5699, fallbackPriceHkd: 5699,
        departures: [{ date: '2026-12-24', priceHkd: 5699 }, { date: '2026-12-25', priceHkd: null }],
        priceChange: null,
        lastUpdated: RUN_FINISHED,
      } satisfies TourCardData],
    });
    const kix = (await searchTours(db, { filters: { operators: ['egl'] }, sort: 'price', page: 1, today })).tours[0];
    expect(kix.lastUpdated).toBe(EGL_SECOND_RUN_FINISHED);
  });

  it('stops come back in route order with ids', async () => {
    const r = await searchTours(db, { filters: { operators: ['egl', 'jetour'] }, sort: 'price', page: 1, today });
    const byKey = new Map(r.tours.map(t => [t.key, t]));
    expect(byKey.get('egl:KIX5')!.stops.map(s => s.cityId)).toEqual(['japan-kansai-osaka', 'japan-kansai-kyoto', 'japan-kansai-nara']);
    expect(byKey.get('egl:KIX5')!.stops).toEqual([OSAKA, KYOTO, NARA]);
    expect(byKey.get('jetour:TYO-KIX')!.stops).toEqual([TOKYO, HAKONE, OSAKA]);
    expect(byKey.get('jetour:HKD7')!.stops).toEqual([HOKKAIDO, SAPPORO]);
  });

  it('a page past the end is empty but still reports the total', async () => {
    expect(await searchTours(db, { filters: {}, sort: 'price', page: 2, today })).toEqual({ tours: [], total: 5 });
  });

  it('a huge page number gives an empty page, not an error', async () => {
    expect(await searchTours(db, { filters: {}, sort: 'price', page: 1e11, today })).toEqual({ tours: [], total: 5 });
    expect(await searchTours(db, { filters: {}, sort: 'price', page: Number.MAX_SAFE_INTEGER, today })).toEqual({ tours: [], total: 5 });
    expect(await searchTours(db, { filters: {}, sort: 'price', page: 1e300, today })).toEqual({ tours: [], total: 5 });
  });

  it('a numeric filter that is not an integer in the int4 range is ignored', async () => {
    const all = await keys({});
    for (const bad of [5.5, NaN, Infinity, -Infinity, 2 ** 31, -(2 ** 31) - 1, 1e11]) {
      expect(await keys({ daysMin: bad }), `daysMin ${bad}`).toEqual(all);
      expect(await keys({ daysMax: bad }), `daysMax ${bad}`).toEqual(all);
      expect(await keys({ priceMin: bad }), `priceMin ${bad}`).toEqual(all);
      expect(await keys({ priceMax: bad }), `priceMax ${bad}`).toEqual(all);
    }
    // A bad bound is dropped on its own; the good one still applies.
    expect(await keys({ daysMin: 5.5, daysMax: 5 })).toEqual(['bigline:TPE4', 'texpert:SEL5', 'egl:KIX5']);
    // The int4 limits themselves are valid integers.
    expect(await keys({ priceMin: -(2 ** 31), priceMax: 2 ** 31 - 1 })).toEqual(all);
  });

  it('an unknown sort value falls back to the price order', async () => {
    const byPrice = await keys({}, 'price');
    for (const bogus of ['bogus', 'constructor', '__proto__', 'toString', '']) {
      expect(await keys({}, bogus as SortKey), `sort ${JSON.stringify(bogus)}`).toEqual(byPrice);
    }
  });

  it('a search matching nothing makes no follow-up queries', async () => {
    const c = countingDb(db);
    const r = await searchTours(c.db, { filters: { operators: ['egl'], daysMin: 30 }, sort: 'price', page: 1, today });
    expect(r).toEqual({ tours: [], total: 0 });
    expect(c.count()).toBe(1);
  });

  it('getToursByKeys returns every upcoming departure and omits unknown or inactive keys', async () => {
    const m = await getToursByKeys(db, ['egl:KIX5', 'egl:OLD', 'egl:NOPE', 'garbage'], today);
    expect([...m.keys()]).toEqual(['egl:KIX5']);
    expect(m.get('egl:KIX5')!.departures.map(d => d.date)).toEqual(['2026-12-18', '2026-12-27']);
  });

  it('getToursByKeys keeps the order of the keys asked for and fills every field', async () => {
    const m = await getToursByKeys(db, ['texpert:SEL5', 'egl:KIX5', 'texpert:SEL5'], today);
    expect([...m.keys()]).toEqual(['texpert:SEL5', 'egl:KIX5']);
    const kix = m.get('egl:KIX5')!;
    expect(kix).toMatchObject({
      operatorId: 'egl', days: 5, nights: 4, stops: [OSAKA, KYOTO, NARA],
      fromPriceHkd: 7999, windowPriceHkd: 7999, fallbackPriceHkd: 7999,
      priceChange: { kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' },
      lastUpdated: EGL_SECOND_RUN_FINISHED,
    });
  });

  it('fallbackPriceHkd is the stored from-price, even when the computed fromPriceHkd differs', async () => {
    // On 2026-12-26 the 7999 departure of egl:KIX5 has passed: the upcoming minimum is 8999,
    // but a departure without its own price is still priced at the stored 7999.
    const later: IsoDate = '2026-12-26';
    const searched = (await searchTours(db, { filters: { operators: ['egl'] }, sort: 'price', page: 1, today: later })).tours[0];
    const byKey = (await getToursByKeys(db, ['egl:KIX5'], later)).get('egl:KIX5')!;
    for (const kix of [searched, byKey]) {
      expect(kix.key).toBe('egl:KIX5');
      expect(kix.fromPriceHkd).toBe(8999);
      expect(kix.fallbackPriceHkd).toBe(7999);
    }
  });

  it('getToursByKeys lists only departures after today and omits a tour with none left', async () => {
    const m = await getToursByKeys(db, ['egl:KIX5', 'texpert:SEL5'], '2026-12-26');
    expect([...m.keys()]).toEqual(['egl:KIX5']);
    expect(m.get('egl:KIX5')!.departures).toEqual([{ date: '2026-12-27', priceHkd: 8999 }]);
    expect(m.get('egl:KIX5')!.fromPriceHkd).toBe(8999);
  });

  it('getToursByKeys with [] makes no query and returns an empty map', async () => {
    const c = countingDb(db);
    const m = await getToursByKeys(c.db, [], today);
    expect(m.size).toBe(0);
    expect(c.count()).toBe(0);
  });

  it('getOperators returns four operators with names, colours and freshness', async () => {
    expect(await getOperators(db)).toEqual([
      { id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: EGL_SECOND_RUN_FINISHED },
      { id: 'jetour', nameZh: '捷旅', nameEn: 'Jetour', color: '#ee7b06', lastGoodRunAt: RUN_FINISHED },
      { id: 'texpert', nameZh: '專業旅運', nameEn: 'Travel Expert', color: '#7d3cc8', lastGoodRunAt: RUN_FINISHED },
      { id: 'bigline', nameZh: '大航假期', nameEn: 'Big Line Holiday', color: '#2a9d4b', lastGoodRunAt: RUN_FINISHED },
    ]);
  });
});

describe('paging', () => {
  let db: Db;
  const extraKeys = Array.from({ length: 30 }, (_, i) => `bigline:P${String(i + 1).padStart(2, '0')}`);

  beforeAll(async () => {
    db = await createTestDb();
    await seed(db);
    const extras = extraKeys.map(k => tour('bigline', k.slice('bigline:'.length), [TAIPEI], 3,
      [{ date: '2026-12-10', priceHkd: 4000 }], 4000));
    // Saved in reverse key order, so the key tie-break, not insertion order, decides the order.
    await save(db, 'bigline', [TPE4, ...extras.reverse()]);
  });
  afterAll(async () => { await db.close(); });

  const page = (n: number) => searchTours(db, { filters: {}, sort: 'price', page: n, today });

  it('pages with a stable order and reports the total', async () => {
    const p1 = await page(1);
    const p2 = await page(2);
    expect(p1.total).toBe(35);
    expect(p2.total).toBe(35);
    expect(p1.tours).toHaveLength(PAGE_SIZE);
    expect(p2.tours).toHaveLength(35 - PAGE_SIZE);

    const all = [...p1.tours, ...p2.tours].map(t => t.key);
    expect(new Set(all).size).toBe(35);
    // Equal prices fall back to the key, so the order is fixed.
    expect(all).toEqual([
      'bigline:TPE4', ...extraKeys, 'texpert:SEL5', 'egl:KIX5', 'jetour:TYO-KIX', 'jetour:HKD7',
    ]);
    expect((await page(1)).tours.map(t => t.key)).toEqual(p1.tours.map(t => t.key));
    expect(await page(3)).toEqual({ tours: [], total: 35 });
  });

  it('page 0 and negative pages behave as page 1', async () => {
    const first = (await page(1)).tours.map(t => t.key);
    expect((await page(0)).tours.map(t => t.key)).toEqual(first);
    expect((await page(-3)).tours.map(t => t.key)).toEqual(first);
    expect((await page(0)).total).toBe(35);
  });

  it('a fractional page is rounded down and a non-finite page is page 1', async () => {
    const first = (await page(1)).tours.map(t => t.key);
    const second = (await page(2)).tours.map(t => t.key);
    expect((await page(2.7)).tours.map(t => t.key)).toEqual(second);
    expect((await page(1.2)).tours.map(t => t.key)).toEqual(first);
    expect((await page(0.5)).tours.map(t => t.key)).toEqual(first);
    expect((await page(-2.5)).tours.map(t => t.key)).toEqual(first);
    for (const p of [NaN, Infinity, -Infinity]) {
      expect(await page(p), `page ${p}`).toEqual(await page(1));
    }
  });

  it('makes a fixed handful of queries for a full page', async () => {
    const c = countingDb(db);
    const r = await searchTours(c.db, { filters: {}, sort: 'price', page: 1, today });
    expect(r.tours).toHaveLength(24);
    expect(c.count()).toBe(5);
  });

  it('getToursByKeys makes a fixed handful of queries for many keys', async () => {
    const c = countingDb(db);
    const m = await getToursByKeys(c.db, extraKeys, today);
    expect(m.size).toBe(30);
    expect(c.count()).toBe(4);
  });
});

describe('a destination reached only by a middle stop', () => {
  // Kept out of the shared seed so the brief's hand-worked lists stay as written.
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
    await seed(db);
    await save(db, 'texpert', [SEL5, tour('texpert', 'TYO-OSA-NGO', [TOKYO, OSAKA, NAGOYA], 6,
      [{ date: '2026-12-22', priceHkd: 6500 }], 6500)]);
  });
  afterAll(async () => { await db.close(); });

  it('matches the region of a middle stop', async () => {
    const kansai = await searchTours(db, {
      filters: { destination: { countryId: 'japan', regionId: 'japan-kansai' } }, sort: 'price', page: 1, today,
    });
    // egl:KIX5 matches by its first stop, texpert:TYO-OSA-NGO by its middle one, jetour:TYO-KIX by its last one.
    expect(kansai.tours.map(t => t.key)).toEqual(['texpert:TYO-OSA-NGO', 'egl:KIX5', 'jetour:TYO-KIX']);
    expect(kansai.total).toBe(3);
    expect(kansai.tours[0].stops).toEqual([TOKYO, OSAKA, NAGOYA]);
  });
});

describe('before any run', () => {
  it('getOperators reports no freshness', async () => {
    const db = await createTestDb();
    try {
      const ops = await getOperators(db);
      expect(ops.map(o => [o.id, o.lastGoodRunAt])).toEqual([
        ['egl', null], ['jetour', null], ['texpert', null], ['bigline', null],
      ]);
      expect(await getOperators(db, { onlyWithGoodRun: true })).toEqual([]);
    } finally {
      await db.close();
    }
  });
});

describe('operators with a good run', () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
    await save(db, 'texpert', [SEL5]);
    await save(db, 'jetour', [TYO_KIX]);
    // A failed run is not a good run.
    await recordFailedRun(db, { operatorId: 'egl', runDate: today, stats: stats(RUN_FINISHED), reasons: ['no-tours'] });
  });
  afterAll(async () => { await db.close(); });

  it('onlyWithGoodRun lists the operators that have had a good run, in the canonical order', async () => {
    expect(await getOperators(db, { onlyWithGoodRun: true })).toEqual([
      { id: 'jetour', nameZh: '捷旅', nameEn: 'Jetour', color: '#ee7b06', lastGoodRunAt: RUN_FINISHED },
      { id: 'texpert', nameZh: '專業旅運', nameEn: 'Travel Expert', color: '#7d3cc8', lastGoodRunAt: RUN_FINISHED },
    ]);
  });

  it('without the option, every operator is still listed', async () => {
    expect((await getOperators(db)).map(o => [o.id, o.lastGoodRunAt])).toEqual([
      ['egl', null], ['jetour', RUN_FINISHED], ['texpert', RUN_FINISHED], ['bigline', null],
    ]);
    expect((await getOperators(db, { onlyWithGoodRun: false })).map(o => o.id)).toEqual(['egl', 'jetour', 'texpert', 'bigline']);
  });
});
