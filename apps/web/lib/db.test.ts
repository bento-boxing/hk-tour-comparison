// @vitest-environment node
import { rootCertificates } from 'node:tls';
import { it, expect, vi, afterEach } from 'vitest';
import type { Db, PgDbOptions } from '@hktours/db/read';

const { connection, createPgDbCalls } = vi.hoisted(() => ({
  connection: vi.fn(async () => {}),
  createPgDbCalls: [] as Array<[string, PgDbOptions | undefined]>,
}));
vi.mock('next/server', () => ({ connection }));
// The real createPgDb, recording what it is given.
vi.mock('@hktours/db/read', async importOriginal => {
  const actual = await importOriginal<typeof import('@hktours/db/read')>();
  return {
    ...actual,
    createPgDb: (url: string, opts?: PgDbOptions) => { createPgDbCalls.push([url, opts]); return actual.createPgDb(url, opts); },
  };
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetModules();
  connection.mockClear();
  createPgDbCalls.length = 0;
  // Each test starts without a cached pool, as a fresh process would. The key is the one lib/db.ts uses.
  const cache = globalThis as { hktoursDb?: Db };
  await cache.hktoursDb?.close();
  delete cache.hktoursDb;
});

it('importing does not need DATABASE_URL; calling getDb without it throws a clear error', async () => {
  vi.stubEnv('DATABASE_URL', '');
  const { getDb } = await import('./db');
  expect(() => getDb()).toThrow(/DATABASE_URL/);
});

it('returns one Db per process', async () => {
  // The pool connects lazily, so no database is contacted here.
  vi.stubEnv('DATABASE_URL', 'postgres://user:pass@127.0.0.1:1/none');
  const { getDb } = await import('./db');
  const db = getDb();
  expect(getDb()).toBe(db);
});

it('keeps the pool across module reloads (development hot reload), on globalThis', async () => {
  vi.stubEnv('DATABASE_URL', 'postgres://user:pass@127.0.0.1:1/none');
  const first = (await import('./db')).getDb();
  vi.resetModules();
  const second = (await import('./db')).getDb();
  expect(second).toBe(first);
});

it('requestDb marks the render as per-request before handing out the pool', async () => {
  vi.stubEnv('DATABASE_URL', 'postgres://user:pass@127.0.0.1:1/none');
  const { requestDb, getDb } = await import('./db');
  const order: string[] = [];
  connection.mockImplementationOnce(async () => { order.push('connection'); });
  const db = await requestDb();
  order.push('db');
  expect(connection).toHaveBeenCalledTimes(1);
  expect(order).toEqual(['connection', 'db']);
  expect(db).toBe(getDb());
});

it('requestDb without DATABASE_URL rejects with the clear error, after connection()', async () => {
  vi.stubEnv('DATABASE_URL', '');
  const { requestDb } = await import('./db');
  await expect(requestDb()).rejects.toThrow(/DATABASE_URL/);
  expect(connection).toHaveBeenCalledTimes(1);
});

it('passes DATABASE_CA_CERT to the pool, normalised from literal \\n sequences', async () => {
  const pem = rootCertificates[0].trim(); // a real, public certificate
  vi.stubEnv('DATABASE_URL', 'postgres://user:pass@127.0.0.1:1/none');
  vi.stubEnv('DATABASE_CA_CERT', pem.replace(/\n/g, '\\n'));
  const { getDb } = await import('./db');
  getDb();
  expect(createPgDbCalls).toHaveLength(1);
  expect(createPgDbCalls[0][1]?.ca === `${pem}\n`, 'the CA passed on is not the normalised certificate').toBe(true);
});

it('an empty or missing DATABASE_CA_CERT is not supplied', async () => {
  vi.stubEnv('DATABASE_URL', 'postgres://user:pass@127.0.0.1:1/none');
  vi.stubEnv('DATABASE_CA_CERT', '');
  const { getDb } = await import('./db');
  getDb();
  expect(createPgDbCalls).toHaveLength(1);
  expect(createPgDbCalls[0][1]?.ca).toBeUndefined();
});

it('a DATABASE_CA_CERT that is not a certificate gives a clear error that does not echo it', async () => {
  vi.stubEnv('DATABASE_URL', 'postgres://user:pass@127.0.0.1:1/none');
  vi.stubEnv('DATABASE_CA_CERT', 'garbage-value-123');
  const { getDb } = await import('./db');
  let message = '';
  try { getDb(); } catch (err) { message = (err as Error).message; }
  expect(message).toContain('DATABASE_CA_CERT');
  expect(message).not.toContain('garbage-value-123');
  expect(createPgDbCalls).toEqual([]);
});

it('storedDb hands out the pool without connection(), so the page that asks may be made at build time and stored', async () => {
  vi.stubEnv('DATABASE_URL', 'postgres://user:pass@127.0.0.1:1/none');
  vi.stubEnv('BUILD_WITHOUT_DATABASE', '');
  const { storedDb, getDb } = await import('./db');
  expect(await storedDb()).toBe(getDb());
  expect(connection).not.toHaveBeenCalled();
});

it('storedDb in a build without a database (BUILD_WITHOUT_DATABASE=1) awaits connection() first: the page is made per request, never at build time, never stored', async () => {
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('BUILD_WITHOUT_DATABASE', '1');
  const { storedDb } = await import('./db');
  const order: string[] = [];
  // At build time connection() throws Next.js's "render this per request" signal: nothing after it runs.
  connection.mockImplementationOnce(async () => { order.push('connection'); throw new Error('per request'); });
  await expect(storedDb()).rejects.toThrow('per request');
  expect(order).toEqual(['connection']);
});

it.each(['', '0', 'true', 'yes', ' 1'])('only BUILD_WITHOUT_DATABASE=1 counts (not %j)', async value => {
  vi.stubEnv('DATABASE_URL', 'postgres://user:pass@127.0.0.1:1/none');
  vi.stubEnv('BUILD_WITHOUT_DATABASE', value);
  const { storedDb } = await import('./db');
  await storedDb();
  expect(connection).not.toHaveBeenCalled();
});

it('storedDb with BUILD_WITHOUT_DATABASE=1 while the site runs (not a build), on a page built as stored: one log line names the setting', async () => {
  vi.stubEnv('DATABASE_URL', 'postgres://user:pass@127.0.0.1:1/none');
  vi.stubEnv('BUILD_WITHOUT_DATABASE', '1');
  vi.stubEnv('NEXT_PHASE', 'phase-production-server');
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const { storedDb } = await import('./db');
    // A stored page being remade: connection() refuses with Next.js's "render this per request" signal.
    const signal = new Error('Dynamic server usage');
    connection.mockImplementationOnce(async () => { throw signal; });
    await expect(storedDb()).rejects.toBe(signal);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toMatch(/^BUILD_WITHOUT_DATABASE=1 is set while the site runs/);
    expect(String(consoleError.mock.calls[0][0])).not.toContain('postgres://');
  } finally {
    consoleError.mockRestore();
  }
});

it('storedDb with BUILD_WITHOUT_DATABASE=1 during the build logs nothing: making the pages per request is the point there', async () => {
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('BUILD_WITHOUT_DATABASE', '1');
  vi.stubEnv('NEXT_PHASE', 'phase-production-build');
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const { storedDb } = await import('./db');
    connection.mockImplementationOnce(async () => { throw new Error('Dynamic server usage'); });
    await expect(storedDb()).rejects.toThrow('Dynamic server usage');
    expect(consoleError).not.toHaveBeenCalled();
  } finally {
    consoleError.mockRestore();
  }
});

it('storedDb without DATABASE_URL rejects with the clear error', async () => {
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('BUILD_WITHOUT_DATABASE', '');
  const { storedDb } = await import('./db');
  await expect(storedDb()).rejects.toThrow(/DATABASE_URL/);
});
