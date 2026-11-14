import { readFile } from 'node:fs/promises';
import { it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { addDays, type IsoDate } from '@hktours/core';
import { transactionDb } from './db';
import { migrate, saveOperatorRun, type Db } from './index';
import { createTestDb } from './test-db';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });
afterEach(async () => { await db.close(); });

interface TourFields { code?: string; days?: number; fromPriceHkd?: number }

async function insertTour(fields: TourFields = {}): Promise<string> {
  const { code = 'HTBKOK06', days = 6, fromPriceHkd = 7999 } = fields;
  const [row] = await db.query<{ id: string }>(
    `insert into tours (operator_id, code, url, title, days, from_price_hkd, start_kind, end_kind, first_seen, last_seen)
     values ($1, $2, $3, $4, $5, $6, 'hk', 'hk', $7, $7)
     returning id::text`,
    ['egl', code, `https://www.egltours.com/tour/${code}`, '曼谷6天', days, fromPriceHkd, '2026-11-12'],
  );
  return row.id;
}

async function countFor(table: string, tourId: string): Promise<number> {
  const [row] = await db.query<{ n: number }>(`select count(*)::int as n from ${table} where tour_id = $1`, [tourId]);
  return row.n;
}

it('seeds five operators with their colours', async () => {
  const rows = await db.query<{ id: string; color: string }>('select id, color from operators order by id');
  expect(rows).toEqual([
    { id: 'bigline', color: '#2a9d4b' }, { id: 'charming', color: '#b5179e' }, { id: 'egl', color: '#d62839' },
    { id: 'jetour', color: '#ee7b06' }, { id: 'texpert', color: '#7d3cc8' },
  ]);
});

it('migrate is idempotent', async () => { expect(await migrate(db)).toEqual([]); });

it('records each applied migration once', async () => {
  const rows = await db.query<{ name: string }>('select name from schema_migrations order by name');
  expect(rows).toEqual([
    { name: '0001_init.sql' }, { name: '0002_charming_operator.sql' }, { name: '0003_tour_deactivated_on.sql' },
  ]);
});

it('a tour is inactive exactly when it has a deactivated_on date', async () => {
  const tourId = await insertTour();
  await expect(db.query('update tours set active = false where id = $1', [tourId])).rejects.toThrow(/check constraint/);
  await expect(db.query(`update tours set deactivated_on = '2026-11-13' where id = $1`, [tourId]))
    .rejects.toThrow(/check constraint/);
  await db.query(`update tours set active = false, deactivated_on = '2026-11-13' where id = $1`, [tourId]);
  await db.query('update tours set active = true, deactivated_on = null where id = $1', [tourId]);
});

/** A database as the live one stood before 0003: migrations 0001 and 0002 applied, and data in it. */
async function databaseBefore0003(): Promise<Db> {
  const pglite = await PGlite.create();
  const old: Db = {
    query: async <T>(sql: string, params?: unknown[]) => (await pglite.query<T>(sql, params)).rows,
    transaction: fn => pglite.transaction(tx => fn(transactionDb({
      query: async (sql, params) => (await tx.query(sql, params)).rows,
      exec: async sql => { await tx.exec(sql); },
    }))),
    exec: async sql => { await pglite.exec(sql); },
    close: () => pglite.close(),
  };
  await old.exec('create table if not exists schema_migrations (name text primary key, applied_at timestamptz)');
  for (const name of ['0001_init.sql', '0002_charming_operator.sql']) {
    await old.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
    await old.query('insert into schema_migrations (name, applied_at) values ($1, now())', [name]);
  }
  for (const [code, active] of [['ON1', true], ['OFF1', false]] as const) {
    const [{ id }] = await old.query<{ id: string }>(
      `insert into tours (operator_id, code, url, title, days, from_price_hkd, start_kind, end_kind, active, first_seen, last_seen)
       values ('jetour', $1, 'https://www.jetour.com.hk/x', '大阪5天', 5, 6999, 'hk', 'hk', $2, '2026-11-01', '2026-11-05')
       returning id::text`,
      [code, active],
    );
    await old.query(`insert into tour_stops values ($1, 0, 'japan', 'japan-kansai', null)`, [id]);
    await old.query(`insert into departures values ($1, '2026-12-18', 6999)`, [id]);
    await old.query(`insert into price_snapshots values ($1, '2026-11-05', 6999)`, [id]);
  }
  await old.query(
    `insert into scrape_runs (operator_id, run_date, started_at, finished_at, pages_fetched, tours_saved, parse_failures, ok)
     values ('jetour', '2026-11-06', now(), now(), 2, 1, 0, true)`,
  );
  return old;
}

it('migration 0003 applies on top of 0001 and 0002 with data, starting the clock of inactive tours at migration time', async () => {
  const old = await databaseBefore0003();
  try {
    expect(await migrate(old)).toEqual(['0003_tour_deactivated_on.sql']);

    // The Hong Kong date when the migration ran, read from the database rather than the test's clock.
    const [{ migrated }] = await old.query<{ migrated: IsoDate }>(
      `select (applied_at at time zone 'Asia/Hong_Kong')::date::text as migrated
       from schema_migrations where name = '0003_tour_deactivated_on.sql'`,
    );
    expect(await old.query('select code, active, deactivated_on::text from tours order by code')).toEqual([
      { code: 'OFF1', active: false, deactivated_on: migrated },
      { code: 'ON1', active: true, deactivated_on: null },
    ]);
    for (const table of ['tour_stops', 'departures', 'price_snapshots', 'scrape_runs']) {
      const [row] = await old.query<{ n: number }>(`select count(*)::int as n from ${table}`);
      expect(row.n, table).toBe(table === 'scrape_runs' ? 1 : 2);
    }

    // The inherited clock counts like any other: kept after 30 days, deleted after 31.
    const stats = { startedAt: new Date(0), finishedAt: new Date(0), pagesFetched: 1, parseFailures: 0 };
    const tour = {
      operatorId: 'jetour' as const, code: 'ON1', url: 'https://www.jetour.com.hk/x', title: '大阪5天', days: 5, nights: 4,
      stops: [{ countryId: 'japan', regionId: 'japan-kansai', cityId: null }],
      start: { kind: 'hk' as const, label: null }, end: { kind: 'hk' as const, label: null },
      fromPriceHkd: 6999, departures: [{ date: addDays(migrated, 60), priceHkd: 6999 }],
    };
    const save = (runDate: IsoDate) => saveOperatorRun(old, { operatorId: 'jetour', runDate, tours: [tour], unmatched: [], stats });
    await save(addDays(migrated, 30));
    expect((await old.query('select code from tours order by code')).map(r => r.code)).toEqual(['OFF1', 'ON1']);
    await save(addDays(migrated, 31));
    expect((await old.query('select code from tours order by code')).map(r => r.code)).toEqual(['ON1']);
  } finally {
    await old.close();
  }
});

it('rejects a duplicate (operator, code)', async () => {
  await insertTour({ code: 'DUP01' });
  await expect(insertTour({ code: 'DUP01' })).rejects.toThrow(/duplicate key/);
  const [row] = await db.query<{ n: number }>("select count(*)::int as n from tours where code = 'DUP01'");
  expect(row.n).toBe(1);
});

it('rejects days = 0 and from_price_hkd = 50', async () => {
  await expect(insertTour({ code: 'ZERODAYS', days: 0 })).rejects.toThrow(/check constraint/);
  await expect(insertTour({ code: 'CHEAP', fromPriceHkd: 50 })).rejects.toThrow(/check constraint/);
  const [row] = await db.query<{ n: number }>('select count(*)::int as n from tours');
  expect(row.n).toBe(0);
});

it('deleting a tour cascades to stops, departures and snapshots', async () => {
  const tourId = await insertTour();
  await db.query(
    `insert into tour_stops (tour_id, position, country_id, region_id, city_id) values ($1, 0, 'th', 'bangkok', null)`,
    [tourId],
  );
  await db.query(`insert into departures (tour_id, date, price_hkd) values ($1, $2, $3)`, [tourId, '2026-12-18', 7999]);
  await db.query(`insert into price_snapshots (tour_id, date, price_hkd) values ($1, $2, $3)`, [tourId, '2026-11-12', 7999]);
  expect(await countFor('tour_stops', tourId)).toBe(1);
  expect(await countFor('departures', tourId)).toBe(1);
  expect(await countFor('price_snapshots', tourId)).toBe(1);

  await db.query('delete from tours where id = $1', [tourId]);

  expect(await countFor('tour_stops', tourId)).toBe(0);
  expect(await countFor('departures', tourId)).toBe(0);
  expect(await countFor('price_snapshots', tourId)).toBe(0);
});

it('returns dates as YYYY-MM-DD strings when selected as text', async () => {
  const tourId = await insertTour();
  await db.query(`insert into departures (tour_id, date, price_hkd) values ($1, $2, $3)`, [tourId, '2026-12-18', 7999]);
  const rows = await db.query<{ date: string }>('select date::text as date from departures where tour_id = $1', [tourId]);
  expect(rows).toEqual([{ date: '2026-12-18' }]);
});

it('transaction rolls back on throw', async () => {
  await expect(db.transaction(async tx => {
    await tx.query("update operators set color = '#000000' where id = 'egl'");
    throw new Error('boom');
  })).rejects.toThrow('boom');
  const [row] = await db.query<{ color: string }>("select color from operators where id = 'egl'");
  expect(row.color).toBe('#d62839');
});

it('transaction commits and returns the callback result', async () => {
  const result = await db.transaction(async tx => {
    await tx.query("update operators set color = $1 where id = 'egl'", ['#111111']);
    return 'done';
  });
  expect(result).toBe('done');
  const [row] = await db.query<{ color: string }>("select color from operators where id = 'egl'");
  expect(row.color).toBe('#111111');
});
