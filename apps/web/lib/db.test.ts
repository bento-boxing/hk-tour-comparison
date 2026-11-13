// @vitest-environment node
import { it, expect, vi, afterEach } from 'vitest';
import type { Db } from '@hktours/db/read';

const { connection } = vi.hoisted(() => ({ connection: vi.fn(async () => {}) }));
vi.mock('next/server', () => ({ connection }));

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetModules();
  connection.mockClear();
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
