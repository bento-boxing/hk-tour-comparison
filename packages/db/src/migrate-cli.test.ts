import { rootCertificates } from 'node:tls';
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

it('passes DATABASE_CA_CERT on, normalised; an empty one is not supplied', async () => {
  const pem = rootCertificates[0]; // a real, public certificate
  const cas: Array<string | undefined> = [];
  // One database for the three runs (starting PGlite is slow); each run's close() leaves it open.
  const db = await emptyDb();
  const makeDb = (_url: string, ca: string | undefined) => { cas.push(ca); return { ...db, close: async () => {} }; };
  const print = () => {};
  try {
    expect(await runMigrateCli({ DATABASE_URL: 'postgres://x', DATABASE_CA_CERT: pem.replace(/\n/g, '\\n') }, { makeDb, print })).toBe(0);
    expect(await runMigrateCli({ DATABASE_URL: 'postgres://x', DATABASE_CA_CERT: '' }, { makeDb, print })).toBe(0);
    expect(await runMigrateCli({ DATABASE_URL: 'postgres://x' }, { makeDb, print })).toBe(0);
  } finally {
    await db.close();
  }
  expect(cas[0] === `${pem.trim()}\n`, 'the CA passed on is not the normalised certificate').toBe(true);
  expect(cas.slice(1)).toEqual([undefined, undefined]);
});

it('exits 2 when DATABASE_CA_CERT is not a certificate, without connecting or echoing it', async () => {
  const printed: string[] = [];
  const code = await runMigrateCli({ DATABASE_URL: 'postgres://x', DATABASE_CA_CERT: 'garbage-value-123' }, {
    makeDb: () => { throw new Error('no database with a bad DATABASE_CA_CERT'); },
    print: line => printed.push(line),
  });
  expect(code).toBe(2);
  expect(printed.join('\n')).toContain('DATABASE_CA_CERT');
  expect(printed.join('\n')).not.toContain('garbage-value-123');
});

it('says so when there is nothing to apply', async () => {
  const db = await emptyDb();
  await migrate(db);
  const printed: string[] = [];
  expect(await runMigrateCli({ DATABASE_URL: 'postgres://x' }, { makeDb: () => db, print: l => printed.push(l) })).toBe(0);
  expect(printed).toEqual(['no migrations to apply']);
});
