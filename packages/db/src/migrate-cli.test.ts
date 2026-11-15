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

it('a failing migration: names the file, prints the database error as a public log may, exits 1 and closes', async () => {
  const db = await emptyDb();
  // The first migration applies; the second fails with a database error whose detail quotes a row (invented values).
  let migrations = 0;
  const failing: Db = {
    ...db,
    transaction: async fn => {
      if (++migrations === 2) {
        throw Object.assign(new Error('could not create unique index "tours_code_key"'), {
          name: 'error', code: '23505', severity: 'ERROR', schema: 'public', table: 'tours', constraint: 'tours_code_key',
          detail: 'Key (code)=(測試之旅) is duplicated.',
        });
      }
      return db.transaction(fn);
    },
  };
  const printed: string[] = [];
  expect(await runMigrateCli({ DATABASE_URL: 'postgres://x' }, { makeDb: () => failing, print: line => printed.push(line) })).toBe(1);
  expect(printed.slice(0, 4)).toEqual([
    'applied 1 migration:',
    '  0001_init.sql',
    'migration 0002_charming_operator.sql failed: MigrationError: 0002_charming_operator.sql was rolled back',
    '  cause: error (code 23505, severity ERROR, schema public, table tours, constraint tours_code_key): '
      + 'could not create unique index "tours_code_key"',
  ]);
  expect(printed.slice(4).every(line => line.startsWith('    at '))).toBe(true);
  for (const line of printed) expect(line).not.toContain('測試');
  expect(db.closed()).toBe(true);
});

it('an error before any migration (connecting, say) is printed by the same rule and exits 1', async () => {
  const db = await emptyDb();
  const refused: Db = {
    ...db,
    exec: async () => { throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' }); },
  };
  const printed: string[] = [];
  expect(await runMigrateCli({ DATABASE_URL: 'postgres://x' }, { makeDb: () => refused, print: line => printed.push(line) })).toBe(1);
  expect(printed[0]).toBe('the migrations stopped on an error: Error (code ECONNREFUSED): connect ECONNREFUSED 127.0.0.1:5432');
  expect(db.closed()).toBe(true);
});

it('says so when there is nothing to apply', async () => {
  const db = await emptyDb();
  await migrate(db);
  const printed: string[] = [];
  expect(await runMigrateCli({ DATABASE_URL: 'postgres://x' }, { makeDb: () => db, print: l => printed.push(l) })).toBe(0);
  expect(printed).toEqual(['no migrations to apply']);
});
