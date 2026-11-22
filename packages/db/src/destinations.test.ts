import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { IsoDate, NormalisedTour, OperatorId, Stop } from '@hktours/core';
import type { Db } from './db';
import { createTestDb } from './test-db';
import { saveOperatorRun } from './save-run';
import { countToursByDestination } from './destinations';
import { searchTours } from './search';

const today: IsoDate = '2026-11-12';

const OSAKA: Stop = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' };
const KYOTO: Stop = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-kyoto' };
const TOKYO: Stop = { countryId: 'japan', regionId: 'japan-kanto', cityId: 'japan-kanto-tokyo' };
const SEOUL: Stop = { countryId: 'korea', regionId: 'korea-seoul', cityId: 'korea-seoul-seoul' };
const SHANGHAI: Stop = { countryId: 'china', regionId: 'china-shanghai', cityId: null };
const EAST: Stop = { countryId: 'china', regionId: 'china-area-east', cityId: null };

function tour(operatorId: OperatorId, code: string, stops: Stop[], dates: IsoDate[]): NormalisedTour {
  return {
    operatorId, code, url: `https://example.test/${operatorId}/${code}`, title: `${code} 團`,
    days: 5, nights: 4, stops,
    start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
    fromPriceHkd: 5000, departures: dates.map(date => ({ date, priceHkd: 5000 })),
  };
}

async function save(db: Db, operatorId: OperatorId, tours: NormalisedTour[], finishedAt = '2026-11-12T18:00:00.000Z') {
  await saveOperatorRun(db, {
    operatorId, runDate: today, tours, unmatched: [],
    stats: { startedAt: new Date('2026-11-12T17:00:00.000Z'), finishedAt: new Date(finishedAt), pagesFetched: 1, parseFailures: 0 },
  });
}

describe('countToursByDestination', () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
    await save(db, 'egl', [
      tour('egl', 'KIX', [OSAKA, KYOTO], ['2026-12-01']), // two stops in one region: counted once there
      tour('egl', 'TYOKIX', [TOKYO, OSAKA], ['2026-12-02']), // two regions of one country
      tour('egl', 'GONE', [SEOUL], ['2026-11-12']), // its only departure is today: not listed
      tour('egl', 'DROPPED', [SEOUL], ['2026-12-03']),
    ]);
    await save(db, 'egl', [
      tour('egl', 'KIX', [OSAKA, KYOTO], ['2026-12-01']),
      tour('egl', 'TYOKIX', [TOKYO, OSAKA], ['2026-12-02']),
      tour('egl', 'GONE', [SEOUL], ['2026-11-12']),
    ], '2026-11-12T19:00:00.000Z'); // egl:DROPPED is no longer offered: inactive
    await save(db, 'jetour', [
      tour('jetour', 'JPKR', [TOKYO, SEOUL], ['2026-12-05']), // two countries
      tour('jetour', 'SHA', [SHANGHAI, EAST], ['2027-01-10']),
      tour('jetour', 'NOWHERE', [], ['2027-01-11']), // no stops: in the whole count only
    ]);
  });
  afterAll(async () => { await db.close(); });

  it('counts listed tours and their operators in all, per country and per region, in id order', async () => {
    const counts = await countToursByDestination(db, today);
    const plain = ({ range: _range, ...count }: { range?: unknown }) => count;
    expect({ all: plain(counts.all), destinations: counts.destinations.map(plain) }).toEqual({
      all: { tours: 5, operators: 2 },
      destinations: [
        { countryId: 'china', regionId: null, tours: 1, operators: 1 },
        { countryId: 'china', regionId: 'china-area-east', tours: 1, operators: 1 },
        { countryId: 'china', regionId: 'china-shanghai', tours: 1, operators: 1 },
        { countryId: 'japan', regionId: null, tours: 3, operators: 2 },
        { countryId: 'japan', regionId: 'japan-kansai', tours: 2, operators: 1 },
        { countryId: 'japan', regionId: 'japan-kanto', tours: 2, operators: 2 },
        { countryId: 'korea', regionId: null, tours: 1, operators: 1 },
        { countryId: 'korea', regionId: 'korea-seoul', tours: 1, operators: 1 },
      ],
    });
  });

  it('agrees with the unfiltered search: each count is the total its destination search reports', async () => {
    const { all, destinations } = await countToursByDestination(db, today);
    const total = async (destination?: { countryId: string; regionId: string | null }) =>
      (await searchTours(db, { filters: destination ? { destination } : {}, sort: 'price', page: 1, today })).total;
    expect(all.tours).toBe(await total());
    for (const d of destinations) expect(d.tours, `${d.countryId}/${d.regionId}`).toBe(await total(d));
  });

  it('uses today: a later day lists fewer', async () => {
    const later = await countToursByDestination(db, '2026-12-03');
    expect(later.all).toMatchObject({ tours: 3, operators: 1 });
    expect(later.destinations.map(d => d.regionId ?? d.countryId)).toEqual(['china', 'china-area-east', 'china-shanghai', 'japan', 'japan-kanto', 'korea', 'korea-seoul']);
  });

  it('is one statement', async () => {
    let n = 0;
    const counting: Db = { ...db, query: (sql, params) => { n++; return db.query(sql, params); } };
    await countToursByDestination(counting, today);
    expect(n).toBe(1);
  });
});

describe('countToursByDestination on an empty database', () => {
  it('lists nothing', async () => {
    const db = await createTestDb();
    try {
      expect(await countToursByDestination(db, today)).toEqual({ all: { tours: 0, operators: 0 }, destinations: [] });
    } finally {
      await db.close();
    }
  });
});

describe('countToursByDestination: each line\'s lengths and lowest price', () => {
  let db: Db;
  /** A tour of `days` days with these departures (null: no price of its own, so the tour's from-price). */
  const priced = (operatorId: OperatorId, code: string, stops: Stop[], days: number, fromPriceHkd: number, departures: [IsoDate, number | null][]): NormalisedTour => ({
    ...tour(operatorId, code, stops, []), days, nights: days - 1, fromPriceHkd,
    departures: departures.map(([date, priceHkd]) => ({ date, priceHkd })),
  });
  beforeAll(async () => {
    db = await createTestDb();
    await save(db, 'egl', [
      // Its cheapest departure has gone (today): its lowest is the next one's.
      priced('egl', 'KIX3', [OSAKA], 3, 3999, [['2026-11-12', 1999], ['2026-12-01', 4599]]),
      // A departure without its own price counts at the tour's from-price.
      priced('egl', 'TYO8', [TOKYO, OSAKA], 8, 6100, [['2026-12-02', null], ['2026-12-09', 7000]]),
      priced('egl', 'DROPPED', [SEOUL], 2, 100, [['2026-12-03', 100]]),
    ]);
    await save(db, 'egl', [
      priced('egl', 'KIX3', [OSAKA], 3, 3999, [['2026-11-12', 1999], ['2026-12-01', 4599]]),
      priced('egl', 'TYO8', [TOKYO, OSAKA], 8, 6100, [['2026-12-02', null], ['2026-12-09', 7000]]),
    ], '2026-11-12T19:00:00.000Z'); // egl:DROPPED is inactive: its price and length count nowhere
    await save(db, 'jetour', [priced('jetour', 'SEL5', [SEOUL], 5, 2999, [['2026-12-05', 3299]])]);
  });
  afterAll(async () => { await db.close(); });

  it('gives each line with tours its shortest and longest length and its lowest upcoming price', async () => {
    const { all, destinations } = await countToursByDestination(db, today);
    expect(all).toEqual({ tours: 3, operators: 2, range: { minDays: 3, maxDays: 8, minPriceHkd: 3299 } });
    const line = (countryId: string, regionId: string | null) => destinations.find(d => d.countryId === countryId && d.regionId === regionId);
    expect(line('japan', null)).toEqual({ countryId: 'japan', regionId: null, tours: 2, operators: 1, range: { minDays: 3, maxDays: 8, minPriceHkd: 4599 } });
    expect(line('japan', 'japan-kanto')?.range).toEqual({ minDays: 8, maxDays: 8, minPriceHkd: 6100 });
    expect(line('korea', null)?.range).toEqual({ minDays: 5, maxDays: 5, minPriceHkd: 3299 });
  });

  it('agrees with the unfiltered search: the first row cheapest first, shortest first and longest first', async () => {
    const { all, destinations } = await countToursByDestination(db, today);
    const first = async (sort: 'price' | 'days' | 'days-desc', destination?: { countryId: string; regionId: string | null }) =>
      (await searchTours(db, { filters: destination ? { destination } : {}, sort, page: 1, today })).tours[0];
    const lines = [{ line: all, destination: undefined }, ...destinations.map(d => ({ line: d, destination: { countryId: d.countryId, regionId: d.regionId } }))];
    for (const { line, destination } of lines) {
      const name = JSON.stringify(destination ?? 'all');
      expect(line.range?.minPriceHkd, name).toBe((await first('price', destination)).windowPriceHkd);
      expect(line.range?.minDays, name).toBe((await first('days', destination)).days);
      expect(line.range?.maxDays, name).toBe((await first('days-desc', destination)).days);
    }
  });
});
