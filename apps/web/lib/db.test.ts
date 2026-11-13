// @vitest-environment node
import { it, expect, vi, afterEach } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

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
  await db.close();
});
