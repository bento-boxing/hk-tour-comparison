import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { IsoDate, NormalisedTour, OperatorId, Stop } from '@hktours/core';
import type { Db } from './db';
import { createTestDb } from './test-db';
import { saveOperatorRun } from './save-run';
import { countToursInWindows, type DateWindow } from './windows';
import { searchTours } from './search';

const today: IsoDate = '2026-11-22';
const OSAKA: Stop = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' };
const SEOUL: Stop = { countryId: 'korea', regionId: 'korea-seoul', cityId: 'korea-seoul-seoul' };

/** A tour of `days` days with these departures (null: no price of its own, so the tour's from-price). */
function tour(operatorId: OperatorId, code: string, days: number, fromPriceHkd: number, departures: [IsoDate, number | null][]): NormalisedTour {
  return {
    operatorId, code, url: `https://example.test/${operatorId}/${code}`, title: `${code} 團`, days, nights: days - 1,
    stops: [code.startsWith('SEL') ? SEOUL : OSAKA], start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
    fromPriceHkd, departures: departures.map(([date, priceHkd]) => ({ date, priceHkd })),
  };
}

async function save(db: Db, operatorId: OperatorId, tours: NormalisedTour[], finishedAt = '2026-11-21T18:00:00.000Z') {
  await saveOperatorRun(db, {
    operatorId, runDate: '2026-11-22', tours, unmatched: [],
    stats: { startedAt: new Date('2026-11-21T17:00:00.000Z'), finishedAt: new Date(finishedAt), pagesFetched: 1, parseFailures: 0 },
  });
}

const CHRISTMAS: DateWindow = { from: '2026-12-19', to: '2026-12-27' };
const NEW_YEAR: DateWindow = { from: '2027-02-03', to: '2027-02-10' };
const EASTER: DateWindow = { from: '2027-03-24', to: '2027-03-30' };
const WINDOWS = [CHRISTMAS, NEW_YEAR, EASTER];

describe('countToursInWindows', () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
    const kix = [
      // Inside Christmas on its first and last day; its cheaper departure the day before does not count there.
      tour('egl', 'KIX5', 5, 3999, [['2026-12-18', 2999], ['2026-12-19', 4599], ['2026-12-27', null]]),
      // The day after Christmas, then New Year's first day.
      tour('egl', 'KIX9', 9, 8000, [['2026-12-28', 7000], ['2027-02-03', 9100]]),
    ];
    await save(db, 'egl', [...kix, tour('egl', 'DROPPED', 2, 100, [['2026-12-20', 100]])]);
    await save(db, 'egl', kix, '2026-11-21T19:00:00.000Z'); // egl:DROPPED is no longer offered: inactive
    await save(db, 'jetour', [tour('jetour', 'SEL4', 4, 3000, [['2026-12-24', 3500], ['2027-02-10', 2800]])]);
  });
  afterAll(async () => { await db.close(); });

  it('gives, for each window in its order, the tours with a departure inside it, their operators, lengths and lowest price there', async () => {
    expect(await countToursInWindows(db, today, WINDOWS)).toEqual([
      // KIX5's 27 Dec departure has no price of its own, so it counts at the tour's from-price (3,999).
      { tours: 2, operators: 2, range: { minDays: 4, maxDays: 5, minPriceHkd: 3500 } },
      { tours: 2, operators: 2, range: { minDays: 4, maxDays: 9, minPriceHkd: 2800 } },
      { tours: 0, operators: 0 },
    ]);
  });

  it('agrees with the search with that departure window and no other filter: its total and its cheapest row', async () => {
    const counts = await countToursInWindows(db, today, WINDOWS);
    for (const [i, w] of WINDOWS.entries()) {
      const { total, tours } = await searchTours(db, { filters: { dateFrom: w.from, dateTo: w.to }, sort: 'price', page: 1, today });
      expect(counts[i].tours).toBe(total);
      expect(counts[i].range?.minPriceHkd).toBe(tours[0]?.windowPriceHkd);
    }
  });

  it('counts only departures after today: inside a window, the days gone are left out', async () => {
    // On 24 Dec only KIX5's 27 Dec departure is still to come.
    expect(await countToursInWindows(db, '2026-12-24', [CHRISTMAS])).toEqual([
      { tours: 1, operators: 1, range: { minDays: 5, maxDays: 5, minPriceHkd: 3999 } },
    ]);
    expect(await countToursInWindows(db, '2026-12-27', [CHRISTMAS])).toEqual([{ tours: 0, operators: 0 }]);
  });

  it('is one statement for any number of windows, and none for no window', async () => {
    let n = 0;
    const counting: Db = { ...db, query: (sql, params) => { n++; return db.query(sql, params); } };
    await countToursInWindows(counting, today, WINDOWS);
    expect(n).toBe(1);
    expect(await countToursInWindows(counting, today, [])).toEqual([]);
    expect(n).toBe(1);
  });
});
