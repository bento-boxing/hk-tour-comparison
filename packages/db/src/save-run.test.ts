import { it, expect, beforeEach, afterEach } from 'vitest';
import { addDays, type IsoDate, type NormalisedTour } from '@hktours/core';
import type { Db } from './db';
import { createTestDb } from './test-db';
import { saveOperatorRun, recordFailedRun, previousGoodTourCount, type GoodRun, type RunStats } from './save-run';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });
afterEach(async () => { await db.close(); });

const stats: RunStats = {
  startedAt: new Date('2026-11-12T18:00:00.000Z'),
  finishedAt: new Date('2026-11-12T18:42:17.123Z'),
  pagesFetched: 40,
  parseFailures: 2,
};

function tour(code: string, patch: Partial<NormalisedTour> = {}): NormalisedTour {
  return {
    operatorId: 'jetour', code, url: `https://www.jetour.com.hk/tour/${code}`, title: '大阪京都6天',
    days: 6, nights: 5,
    stops: [
      { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' },
      { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-kyoto' },
    ],
    start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
    fromPriceHkd: 7999,
    departures: [{ date: '2026-12-18', priceHkd: 7999 }],
    ...patch,
  };
}

function run(runDate: IsoDate, tours: NormalisedTour[]): GoodRun {
  return { operatorId: 'jetour', runDate, tours, unmatched: [], stats };
}

interface TourRow { code: string; active: boolean; first_seen: string; last_seen: string; from_price_hkd: number }

async function tours(): Promise<TourRow[]> {
  return db.query<TourRow>(
    `select code, active, first_seen::text, last_seen::text, from_price_hkd from tours order by operator_id, code`,
  );
}

async function activeByKey(): Promise<Record<string, boolean>> {
  const rows = await db.query<{ key: string; active: boolean }>(
    `select operator_id || ':' || code as key, active from tours order by key`,
  );
  return Object.fromEntries(rows.map(r => [r.key, r.active]));
}

async function departures(code: string) {
  return db.query<{ date: string; price_hkd: number | null }>(
    `select d.date::text, d.price_hkd from departures d join tours t on t.id = d.tour_id
     where t.code = $1 order by d.date`, [code],
  );
}

async function snapshots(code: string) {
  return db.query<{ date: string; price_hkd: number }>(
    `select s.date::text, s.price_hkd from price_snapshots s join tours t on t.id = s.tour_id
     where t.code = $1 order by s.date`, [code],
  );
}

async function count(table: string): Promise<number> {
  const [row] = await db.query<{ n: number }>(`select count(*)::int as n from ${table}`);
  return row.n;
}

/** operators.last_good_run_at in epoch milliseconds, or null. */
async function lastGoodRunMs(operatorId: string): Promise<number | null> {
  const [row] = await db.query<{ ms: number | null }>(
    `select (extract(epoch from last_good_run_at) * 1000)::float8 as ms from operators where id = $1`, [operatorId],
  );
  return row.ms;
}

it('inserts tours with stops, departures and a snapshot', async () => {
  await saveOperatorRun(db, run('2026-11-12', [tour('A')]));

  expect(await tours()).toEqual([
    { code: 'A', active: true, first_seen: '2026-11-12', last_seen: '2026-11-12', from_price_hkd: 7999 },
  ]);
  const stops = await db.query<{ position: number; city_id: string }>(
    'select position, city_id from tour_stops order by position',
  );
  expect(stops).toEqual([
    { position: 0, city_id: 'japan-kansai-osaka' },
    { position: 1, city_id: 'japan-kansai-kyoto' },
  ]);
  expect(await departures('A')).toEqual([{ date: '2026-12-18', price_hkd: 7999 }]);
  expect(await snapshots('A')).toEqual([{ date: '2026-11-12', price_hkd: 7999 }]);
});

it('saves every tour field, a stop without a city and a departure without a price', async () => {
  await saveOperatorRun(db, run('2026-11-12', [tour('A', {
    url: 'https://www.jetour.com.hk/tour/A?x=1', title: '關西7天', days: 7, nights: null,
    stops: [{ countryId: 'japan', regionId: 'japan-kansai', cityId: null }],
    start: { kind: 'other', label: '深圳灣' }, end: { kind: 'sz', label: null },
    departures: [{ date: '2026-12-18', priceHkd: null }, { date: '2026-12-19', priceHkd: 8299 }],
  })]));

  const [row] = await db.query(
    `select url, title, days, nights, start_kind, start_label, end_kind, end_label from tours`,
  );
  expect(row).toEqual({
    url: 'https://www.jetour.com.hk/tour/A?x=1', title: '關西7天', days: 7, nights: null,
    start_kind: 'other', start_label: '深圳灣', end_kind: 'sz', end_label: null,
  });
  expect(await db.query('select position, country_id, region_id, city_id from tour_stops')).toEqual([
    { position: 0, country_id: 'japan', region_id: 'japan-kansai', city_id: null },
  ]);
  expect(await departures('A')).toEqual([
    { date: '2026-12-18', price_hkd: null },
    { date: '2026-12-19', price_hkd: 8299 },
  ]);
});

it('updates an existing tour and keeps first_seen', async () => {
  await saveOperatorRun(db, run('2026-11-12', [tour('A')]));
  await saveOperatorRun(db, run('2026-11-13', [tour('A', {
    fromPriceHkd: 7499, departures: [{ date: '2026-12-20', priceHkd: 7499 }],
  })]));

  expect(await tours()).toEqual([
    { code: 'A', active: true, first_seen: '2026-11-12', last_seen: '2026-11-13', from_price_hkd: 7499 },
  ]);
  expect(await departures('A')).toEqual([{ date: '2026-12-20', price_hkd: 7499 }]);
  expect(await snapshots('A')).toEqual([
    { date: '2026-11-12', price_hkd: 7999 },
    { date: '2026-11-13', price_hkd: 7499 },
  ]);
  expect(await count('tour_stops')).toBe(2);
});

it('deactivates tours missing from tonight, for this operator only', async () => {
  await saveOperatorRun(db, run('2026-11-12', [tour('A'), tour('B')]));
  await saveOperatorRun(db, { ...run('2026-11-12', [tour('X')]), operatorId: 'egl' });
  await saveOperatorRun(db, run('2026-11-13', [tour('A')]));

  expect(await activeByKey()).toEqual({ 'egl:X': true, 'jetour:A': true, 'jetour:B': false });
});

it('reactivates a tour that comes back', async () => {
  await saveOperatorRun(db, run('2026-11-12', [tour('A')]));
  await saveOperatorRun(db, run('2026-11-13', [tour('B')]));
  expect(await activeByKey()).toEqual({ 'jetour:A': false, 'jetour:B': true });

  await saveOperatorRun(db, run('2026-11-14', [tour('A')]));
  expect(await activeByKey()).toEqual({ 'jetour:A': true, 'jetour:B': false });
  const [a] = (await tours()).filter(t => t.code === 'A');
  expect(a).toMatchObject({ first_seen: '2026-11-12', last_seen: '2026-11-14' });
});

it('keeps exactly 8 nights of snapshots', async () => {
  for (let i = 0; i < 10; i++) {
    await saveOperatorRun(db, run(addDays('2026-11-03', i), [tour('A', { fromPriceHkd: 7000 + i })]));
  }

  expect(await snapshots('A')).toEqual([
    { date: '2026-11-05', price_hkd: 7002 },
    { date: '2026-11-06', price_hkd: 7003 },
    { date: '2026-11-07', price_hkd: 7004 },
    { date: '2026-11-08', price_hkd: 7005 },
    { date: '2026-11-09', price_hkd: 7006 },
    { date: '2026-11-10', price_hkd: 7007 },
    { date: '2026-11-11', price_hkd: 7008 },
    { date: '2026-11-12', price_hkd: 7009 },
  ]);
});

it('counts unmatched names across runs', async () => {
  await saveOperatorRun(db, { ...run('2026-11-12', [tour('A')]), unmatched: [{ name: '亞特蘭提斯', tourCode: 'A' }] });
  await saveOperatorRun(db, { ...run('2026-11-13', [tour('B')]), unmatched: [{ name: '亞特蘭提斯', tourCode: 'B' }] });

  expect(await db.query(
    'select operator_id, name, example_tour_code, seen_count, last_seen::text from unmatched_places',
  )).toEqual([
    { operator_id: 'jetour', name: '亞特蘭提斯', example_tour_code: 'B', seen_count: 2, last_seen: '2026-11-13' },
  ]);
});

it('records the run and the operator freshness', async () => {
  await saveOperatorRun(db, run('2026-11-12', [tour('A')]));

  const runs = await db.query(
    `select operator_id, run_date::text, ok, tours_saved, pages_fetched, parse_failures, reasons,
            (extract(epoch from started_at) * 1000)::float8 as started_ms,
            (extract(epoch from finished_at) * 1000)::float8 as finished_ms
     from scrape_runs`,
  );
  expect(runs).toEqual([{
    operator_id: 'jetour', run_date: '2026-11-12', ok: true, tours_saved: 1, pages_fetched: 40, parse_failures: 2,
    reasons: [], started_ms: stats.startedAt.getTime(), finished_ms: stats.finishedAt.getTime(),
  }]);
  expect(await lastGoodRunMs('jetour')).toBe(stats.finishedAt.getTime());
  expect(await lastGoodRunMs('egl')).toBeNull();
  expect(await previousGoodTourCount(db, 'jetour')).toBe(1);
  expect(await previousGoodTourCount(db, 'egl')).toBeNull();
});

it('previousGoodTourCount returns the most recent ok run', async () => {
  await saveOperatorRun(db, run('2026-11-12', [tour('A'), tour('B')]));
  await saveOperatorRun(db, run('2026-11-13', [tour('A')]));
  expect(await previousGoodTourCount(db, 'jetour')).toBe(1);
});

it('a failed run changes no data', async () => {
  await saveOperatorRun(db, run('2026-11-12', [tour('A')]));
  await recordFailedRun(db, {
    operatorId: 'jetour', runDate: '2026-11-13',
    stats: { ...stats, finishedAt: new Date('2026-11-13T18:30:00.000Z') }, reasons: ['no-tours'],
  });

  expect(await tours()).toEqual([
    { code: 'A', active: true, first_seen: '2026-11-12', last_seen: '2026-11-12', from_price_hkd: 7999 },
  ]);
  expect(await lastGoodRunMs('jetour')).toBe(stats.finishedAt.getTime());
  expect(await db.query(
    'select run_date::text, ok, tours_saved, reasons from scrape_runs order by run_date',
  )).toEqual([
    { run_date: '2026-11-12', ok: true, tours_saved: 1, reasons: [] },
    { run_date: '2026-11-13', ok: false, tours_saved: 0, reasons: ['no-tours'] },
  ]);
  expect(await previousGoodTourCount(db, 'jetour')).toBe(1);
});

it('rolls back everything if one tour fails to save', async () => {
  await expect(saveOperatorRun(db, run('2026-11-12', [tour('A'), tour('B', { days: 0 })])))
    .rejects.toThrow(/check constraint/);

  expect(await count('tours')).toBe(0);
  expect(await count('tour_stops')).toBe(0);
  expect(await count('departures')).toBe(0);
  expect(await count('price_snapshots')).toBe(0);
  expect(await count('scrape_runs')).toBe(0);
  expect(await lastGoodRunMs('jetour')).toBeNull();
});
