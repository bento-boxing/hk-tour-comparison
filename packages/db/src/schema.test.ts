import { it, expect, beforeEach, afterEach } from 'vitest';
import { migrate, type Db } from './index';
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
  expect(rows).toEqual([{ name: '0001_init.sql' }, { name: '0002_charming_operator.sql' }]);
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
