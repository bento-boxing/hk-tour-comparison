// @vitest-environment node
import { it, expect, beforeAll, afterAll } from 'vitest';
import type { NormalisedTour, OperatorId, Stop } from '@hktours/core';
import { saveOperatorRun, type Db } from '@hktours/db';
// The in-memory test database is imported here, in the test, never by app code.
import { createTestDb } from '@hktours/db/test';
import { loadSavedPage } from './saved-page-data';
import { createReads, type CacheFn } from './cached-reads';
import { savedHref, SAVED_CAP } from './saved-list';

const today = '2026-11-12';
const OSAKA: Stop = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' };

function tour(operatorId: OperatorId, code: string, date: string): NormalisedTour {
  return {
    operatorId, code, url: `https://example.test/${operatorId}/${code}`, title: `${code} 團`,
    days: 4, nights: 3, stops: [OSAKA],
    start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
    fromPriceHkd: 5000, departures: [{ date, priceHkd: 5000 }],
  };
}

const stats = { startedAt: new Date('2026-11-12T18:00:00Z'), finishedAt: new Date('2026-11-12T18:30:00Z'), pagesFetched: 1, parseFailures: 0 };
let db: Db;
let connects = 0;
const connect = async () => { connects++; return db; };

beforeAll(async () => {
  db = await createTestDb();
  // KIX1 and KIX2 are listed; OLD was listed in an earlier run only; PAST has only a departure already gone.
  await saveOperatorRun(db, { operatorId: 'egl', runDate: '2026-11-05', tours: [tour('egl', 'OLD', '2026-12-20')], unmatched: [], stats });
  await saveOperatorRun(db, {
    operatorId: 'egl', runDate: today, unmatched: [], stats,
    tours: [tour('egl', 'KIX1', '2026-12-18'), tour('egl', 'KIX2', '2026-12-19'), tour('egl', 'PAST', '2026-11-12')],
  });
  await saveOperatorRun(db, { operatorId: 'jetour', runDate: today, tours: [tour('jetour', 'THB', '2026-12-21')], unmatched: [], stats });
});

afterAll(async () => { await db.close(); });

const address = (keys: string[]) => Object.fromEntries(new URLSearchParams(savedHref(keys).split('?')[1] ?? ''));

it('the tours the address asks for, in its order (newest saved first), without their names', async () => {
  const data = await loadSavedPage(connect, address(['jetour:THB', 'egl:KIX2', 'egl:KIX1']), today);
  expect(data.asked).toEqual(['jetour:THB', 'egl:KIX2', 'egl:KIX1']);
  expect(data.tours.map(t => t.key)).toEqual(['jetour:THB', 'egl:KIX2', 'egl:KIX1']);
  expect(data.tours.every(t => !('title' in t))).toBe(true);
  expect(data.operators.map(o => o.id)).toContain('egl');
  expect(data.dropped).toBe(0);
});

it('a saved tour that is no longer listed (gone from the last run, or no departure left) stays asked, with no row', async () => {
  const data = await loadSavedPage(connect, address(['egl:OLD', 'egl:KIX1', 'egl:PAST', 'egl:NEVER']), today);
  expect(data.asked).toEqual(['egl:OLD', 'egl:KIX1', 'egl:PAST', 'egl:NEVER']);
  expect(data.tours.map(t => t.key)).toEqual(['egl:KIX1']);
});

it('a hand-made address: only valid keys reach the database; the rest are counted', async () => {
  const data = await loadSavedPage(connect, { t: "egl:KIX1,'; drop table tours;--,egl:KIX1,nobody:X" }, today);
  expect(data.asked).toEqual(['egl:KIX1']);
  expect(data.dropped).toBe(3);
  expect(data.tours.map(t => t.key)).toEqual(['egl:KIX1']);
});

it('no list (or nothing readable in it): nothing to show, and the database is not even opened', async () => {
  const before = connects;
  for (const raw of [{}, { t: '' }, { t: 'garbage,more' }]) {
    const data = await loadSavedPage(connect, raw, today);
    expect(data.asked).toEqual([]);
    expect(data.tours).toEqual([]);
  }
  expect(connects).toBe(before);
});

it(`at most ${SAVED_CAP} keys are asked for, through the cached read: a repeat costs no statement`, async () => {
  const store = new Map<string, unknown>();
  const cache: CacheFn = async (key, load) => (store.has(key) ? store.get(key) : (store.set(key, await load()), store.get(key))) as never;
  const reads = createReads(() => [], cache, 'test');
  const keys = Array.from({ length: SAVED_CAP + 20 }, (_, i) => `egl:K${i}`);
  let statements = 0;
  const counting: Db = { ...db, query: (async (...args: Parameters<Db['query']>) => { statements++; return db.query(...args); }) as Db['query'] };
  const first = await loadSavedPage(async () => counting, { t: ['egl:KIX1', ...keys].join(',') }, today, reads);
  expect(first.asked).toHaveLength(SAVED_CAP);
  expect(first.dropped).toBe(21);
  const cold = statements;
  expect(cold).toBeGreaterThan(0);
  expect(cold).toBeLessThanOrEqual(6); // a fixed handful, however many keys
  await loadSavedPage(async () => counting, { t: ['egl:KIX1', ...keys].join(',') }, today, reads);
  expect(statements).toBe(cold);
  // The cache key holds the keys in a fixed order: the same list in another order is the same entry.
  const reordered = [...first.asked].reverse().join(',');
  await loadSavedPage(async () => counting, { t: reordered }, today, reads);
  expect(statements).toBe(cold);
});
