import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { transactionDb, type Db } from './db';
import { migrate } from './migrate';
import { runMigrateCli } from './migrate-cli';

/** An empty in-memory database with no migrations applied. */
async function emptyDb(): Promise<Db & { closed: () => boolean }> {
  const pglite = await PGlite.create();
  let closed = false;
  return {
    query: async <T>(sql: string, params?: unknown[]) => (await pglite.query<T>(sql, params)).rows,
    transaction: fn => pglite.transaction(tx => fn(transactionDb({
      query: async (sql, params) => (await tx.query(sql, params)).rows,
      exec: async sql => { await tx.exec(sql); },
    }))),
    exec: async sql => { await pglite.exec(sql); },
    close: async () => { closed = true; await pglite.close(); },
    closed: () => closed,
  };
}

it('exits 2 without DATABASE_URL and connects to nothing', async () => {
  const printed: string[] = [];
  const code = await runMigrateCli({}, {
    makeDb: () => { throw new Error('no database without DATABASE_URL'); },
    print: line => printed.push(line),
  });
  expect(code).toBe(2);
  expect(printed.join('\n')).toContain('DATABASE_URL');
});

it('applies the migrations to DATABASE_URL, prints them, and closes the connection', async () => {
  const db = await emptyDb();
  const printed: string[] = [];
  const urls: string[] = [];
  const deps = { makeDb: (url: string) => { urls.push(url); return db; }, print: (line: string) => printed.push(line) };

  expect(await runMigrateCli({ DATABASE_URL: 'postgres://example.invalid/tours' }, deps)).toBe(0);
  expect(urls).toEqual(['postgres://example.invalid/tours']);
  expect(printed[0]).toMatch(/^applied \d+ migrations?:$/);
  expect(printed).toContain('  0001_init.sql');
  expect(db.closed()).toBe(true);
});

it('says so when there is nothing to apply', async () => {
  const db = await emptyDb();
  await migrate(db);
  const printed: string[] = [];
  expect(await runMigrateCli({ DATABASE_URL: 'postgres://x' }, { makeDb: () => db, print: l => printed.push(l) })).toBe(0);
  expect(printed).toEqual(['no migrations to apply']);
});
