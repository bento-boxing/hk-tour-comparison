// @vitest-environment node
import { it, expect, beforeAll, afterAll, describe, vi } from 'vitest';
import type { Destination, NormalisedTour, OperatorId, ScrapedDeparture, Stop } from '@hktours/core';
import { saveOperatorRun, searchTours, type Db } from '@hktours/db';
// The in-memory test database is imported here, in the test, never by app code.
import { createTestDb } from '@hktours/db/test';
import type { SortKey } from '@hktours/db/read';
import type { Locale } from './i18n';
import {
  createReads, nextCache, READ_CACHE_SECONDS, READ_CACHE_TAG, usesDestinationOrder, type CacheFn, type SearchQuery,
} from './cached-reads';

const { unstableCache } = vi.hoisted(() => ({ unstableCache: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: unstableCache }));

const today = '2026-11-12';

/**
 * Stands in for Next's data cache, the way unstable_cache treats a value: on a miss the loader's own value
 * is returned and its JSON text stored; on a hit the stored text is parsed. A loader that throws stores nothing.
 */
function jsonStore() {
  const entries = new Map<string, string>();
  const keys: string[] = [];
  const cache: CacheFn = async (key, load) => {
    keys.push(key);
    const hit = entries.get(key);
    if (hit !== undefined) return JSON.parse(hit);
    const value = await load();
    entries.set(key, JSON.stringify(value));
    return value;
  };
  return { cache, entries, keys };
}

/** A Db that counts its queries and passes them on. */
function counting(db: Db) {
  const counter = { queries: 0, db: { ...db, query: (sql: string, params?: unknown[]) => { counter.queries++; return db.query(sql, params); } } as Db };
  return counter;
}

/** Records the locale each order is worked out for, and gives a different order per locale. */
function recordingOrder() {
  const calls: Locale[] = [];
  const orderFor = (locale: Locale) => { calls.push(locale); return [`first-for-${locale}`]; };
  return { calls, orderFor };
}

/** A database that cannot be reached: every query fails with the same error. */
function brokenDb(error: Error): Db & { queries: number } {
  const db = {
    queries: 0,
    query: async () => { db.queries++; throw error; },
    transaction: async () => { throw error; },
    exec: async () => { throw error; },
    close: async () => {},
  };
  return db as Db & { queries: number };
}

const keyOf = (store: ReturnType<typeof jsonStore>) => store.keys.at(-1)!;
const base: SearchQuery = { filters: {}, sort: 'price', page: 1, today };

describe('the key is built only from validated values, in a canonical form', () => {
  const keyFor = async (query: SearchQuery, locale: Locale = 'zh-Hant') => {
    const store = jsonStore();
    // Only the key matters here: the read itself fails, and failures are not stored (see below).
    await createReads(() => [], store.cache).searchTours(brokenDb(new Error('down')), query, locale).catch(() => {});
    return keyOf(store);
  };

  it('equal searches give equal keys: list order, repeats, absent, undefined and empty lists alike', async () => {
    const a = await keyFor({ ...base, filters: { operators: ['jetour', 'egl'], excludeCountryIds: ['korea', 'japan'] } });
    const b = await keyFor({ ...base, filters: { operators: ['egl', 'jetour', 'egl'], excludeCountryIds: ['japan', 'korea'] } });
    expect(b).toBe(a);

    const none = await keyFor(base);
    expect(await keyFor({ ...base, filters: { operators: [], excludeCountryIds: [] } })).toBe(none);
    expect(await keyFor({ ...base, filters: { dateFrom: undefined, priceMin: undefined, destination: undefined } })).toBe(none);
    const japan = await keyFor({ ...base, filters: { destination: { countryId: 'japan', regionId: null } } });
    expect(japan).not.toBe(none);
    const noRegion = { countryId: 'japan', regionId: undefined } as unknown as Destination;
    expect(await keyFor({ ...base, filters: { destination: noRegion } })).toBe(japan);
  });

  it('every filter, the sort, the page and today change the key', async () => {
    const none = await keyFor(base);
    const changed = [
      { ...base, filters: { destination: { countryId: 'japan', regionId: 'japan-kansai' } } },
      { ...base, filters: { excludeCountryIds: ['japan'] } },
      { ...base, filters: { dateFrom: '2026-12-01' } }, { ...base, filters: { dateTo: '2026-12-01' } },
      { ...base, filters: { travelFrom: '2026-12-01' } }, { ...base, filters: { travelTo: '2026-12-01' } },
      { ...base, filters: { daysMin: 3 } }, { ...base, filters: { daysMax: 3 } },
      { ...base, filters: { priceMin: 3 } }, { ...base, filters: { priceMax: 3 } },
      { ...base, filters: { operators: ['egl' as OperatorId] } },
      { ...base, sort: 'days' as SortKey }, { ...base, page: 2 }, { ...base, today: '2026-11-13' },
    ];
    const keys = await Promise.all(changed.map(q => keyFor(q)));
    expect(new Set([none, ...keys]).size).toBe(changed.length + 1);
  });

  it('a field outside the validated input never reaches the key', async () => {
    const extra = { ...base, filters: { ...base.filters, junk: '<script>' }, junk: 'x' } as unknown as SearchQuery;
    expect(await keyFor(extra)).toBe(await keyFor(base));
  });

  it('example keys, as stored', async () => {
    expect(await keyFor({ ...base, filters: { destination: { countryId: 'japan', regionId: 'japan-kansai' }, operators: ['jetour', 'egl'] } }))
      .toBe('{"read":"searchTours","today":"2026-11-12","sort":"price","page":1,"locale":null,"filters":{'
        + '"destination":{"countryId":"japan","regionId":"japan-kansai"},"excludeCountryIds":null,"dateFrom":null,"dateTo":null,'
        + '"travelFrom":null,"travelTo":null,"daysMin":null,"daysMax":null,"priceMin":null,"priceMax":null,"operators":["egl","jetour"]}}');
  });
});

describe('the language splits the cache only for the destination sorts', () => {
  it('which sorts use the destination order', () => {
    expect(['price', 'price-desc', 'days', 'days-desc', 'date', 'date-desc', 'destination', 'destination-desc']
      .filter(s => usesDestinationOrder(s as SortKey))).toEqual(['destination', 'destination-desc']);
  });

  it('a sort without it: one key for every language, and no order is worked out', async () => {
    const store = jsonStore();
    const order = recordingOrder();
    const db = brokenDb(new Error('down'));
    const reads = createReads(order.orderFor, store.cache);
    for (const locale of ['zh-Hant', 'zh-Hans', 'en'] as const) {
      await reads.searchTours(db, { ...base, sort: 'date' }, locale).catch(() => {});
    }
    expect(new Set(store.keys).size).toBe(1);
    expect(order.calls).toEqual([]);
  });

  it('a destination sort: one key per language, each loading the order of its own language', async () => {
    const store = jsonStore();
    const order = recordingOrder();
    // The ranking a page query receives is its 15th parameter (see selectPage in packages/db/src/search.ts).
    const rankings: unknown[] = [];
    const db = {
      query: async (sql: string, params: unknown[]) => {
        if (sql.includes('as total from matched')) return [{ total: 1 }];
        rankings.push(params[14]);
        return [];
      },
    } as unknown as Db;
    const reads = createReads(order.orderFor, store.cache);
    for (const locale of ['en', 'zh-Hans', 'en', 'zh-Hant'] as const) {
      await reads.searchTours(db, { ...base, sort: 'destination-desc' }, locale);
    }
    expect(store.keys.map(k => JSON.parse(k).locale)).toEqual(['en', 'zh-Hans', 'en', 'zh-Hant']);
    expect(new Set(store.keys).size).toBe(3);
    // The third call ('en' again) is a hit: no order worked out, no query.
    expect(order.calls).toEqual(['en', 'zh-Hans', 'zh-Hant']);
    expect(rankings).toEqual([['first-for-en'], ['first-for-zh-Hans'], ['first-for-zh-Hant']]);
  });
});

describe('with the in-process database', () => {
  let db: Db;

  const OSAKA: Stop = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' };
  const SEOUL: Stop = { countryId: 'korea', regionId: 'korea-seoul', cityId: null };
  const TAIPEI: Stop = { countryId: 'taiwan', regionId: 'taiwan-north', cityId: 'taiwan-north-taipei' };
  function tour(operatorId: OperatorId, code: string, stops: Stop[], days: number, departures: ScrapedDeparture[]): NormalisedTour {
    const prices = departures.map(d => d.priceHkd ?? Infinity);
    return {
      operatorId, code, url: `https://example.test/${operatorId}/${code}`, title: `${code} 團`,
      days, nights: days - 1, stops,
      start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
      fromPriceHkd: Math.min(...prices), departures,
    };
  }
  const KIX5 = tour('egl', 'KIX5', [OSAKA], 5, [{ date: '2026-12-18', priceHkd: 7999 }, { date: '2026-12-27', priceHkd: 8999 }]);
  // Every nullable field null somewhere: nights, a start label (and one set), a departure price, a city.
  const SEL5: NormalisedTour = {
    ...tour('texpert', 'SEL5', [SEOUL], 5, [{ date: '2026-12-24', priceHkd: 5699 }, { date: '2026-12-25', priceHkd: null }]),
    start: { kind: 'other', label: '深圳灣' }, end: { kind: 'sz', label: null }, nights: null,
  };
  const TPE4 = tour('bigline', 'TPE4', [TAIPEI], 4, [{ date: '2026-12-23', priceHkd: 3980 }]);

  beforeAll(async () => {
    db = await createTestDb();
    const stats = { startedAt: new Date('2026-11-12T18:00:00Z'), finishedAt: new Date('2026-11-12T18:30:00Z'), pagesFetched: 1, parseFailures: 0 };
    const save = (operatorId: OperatorId, tours: NormalisedTour[]) =>
      saveOperatorRun(db, { operatorId, runDate: today, tours, unmatched: [], stats });
    await save('egl', [KIX5]);
    await save('texpert', [SEL5]);
    await save('bigline', [TPE4]);
    // A week-old snapshot, so one card has a price change.
    await db.query(`insert into price_snapshots (tour_id, date, price_hkd)
      select id, '2026-11-05', 8499 from tours where operator_id = 'egl' and code = 'KIX5'`);
  });

  afterAll(async () => { await db.close(); });

  /** What a value becomes after the cache's JSON storage. */
  const stored = <T>(value: T): unknown => JSON.parse(JSON.stringify(value));

  it('the round-trip check notices each value that JSON does not keep', () => {
    for (const value of [
      { at: new Date('2026-11-12T00:00:00Z') }, { byKey: new Map([['a', 1]]) }, { ids: new Set(['a']) },
      { list: [1, undefined] }, { field: undefined },
    ]) {
      expect(stored(value)).not.toStrictEqual(value);
    }
    expect(() => stored({ n: 1n })).toThrow(); // a bigint cannot be stored at all
  });

  it('every field of every stored read survives storage unchanged', async () => {
    const reads = createReads(() => ['korea-seoul'], (_key, load) => load());
    const search = await reads.searchTours(db, base, 'zh-Hant');
    expect(search.tours.map(t => t.key)).toEqual(['bigline:TPE4', 'texpert:SEL5', 'egl:KIX5']);
    // The variants are really there, so the check covers them.
    expect(search.tours.find(t => t.key === 'egl:KIX5')!.priceChange).toEqual({ kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' });
    expect(search.tours.find(t => t.key === 'texpert:SEL5')).toMatchObject({ nights: null, start: { kind: 'other', label: '深圳灣' } });
    expect(stored(search)).toStrictEqual(search);

    const operators = await reads.getOperators(db);
    expect(operators.some(o => o.lastGoodRunAt === null) && operators.some(o => o.lastGoodRunAt !== null)).toBe(true);
    expect(stored(operators)).toStrictEqual(operators);
    expect(stored(await reads.getOperators(db, { onlyWithGoodRun: true }))).toStrictEqual(await reads.getOperators(db, { onlyWithGoodRun: true }));

    const cards = [...(await reads.getToursByKeys(db, ['egl:KIX5', 'texpert:SEL5'], today)).values()];
    expect(cards).toHaveLength(2);
    expect(stored(cards)).toStrictEqual(cards);
  });

  it('getToursByKeys: a stored entry gives back the same Map, in the order the caller asked', async () => {
    const store = jsonStore();
    const counter = counting(db);
    const reads = createReads(() => [], store.cache);
    const wanted = ['texpert:SEL5', 'egl:KIX5', 'egl:GONE', 'texpert:SEL5'];
    const raw = await (await import('@hktours/db/read')).getToursByKeys(db, wanted, today);

    const first = await reads.getToursByKeys(counter.db, wanted, today);
    const queries = counter.queries;
    const second = await reads.getToursByKeys(counter.db, ['egl:KIX5', 'texpert:SEL5', 'egl:GONE'], today); // same set, other order

    expect(counter.queries).toBe(queries); // served from the store
    expect(store.keys[1]).toBe(store.keys[0]);
    expect(first).toBeInstanceOf(Map);
    expect(second).toBeInstanceOf(Map);
    expect([...first.entries()]).toStrictEqual([...raw.entries()]);
    expect([...second.keys()]).toEqual(['egl:KIX5', 'texpert:SEL5']);
    expect(second.get('texpert:SEL5')).toStrictEqual(raw.get('texpert:SEL5'));
    expect(JSON.parse(store.keys[0])).toEqual({ read: 'getToursByKeys', today, keys: ['egl:GONE', 'egl:KIX5', 'texpert:SEL5'] });
  });

  it('getToursByKeys with no keys asks neither the store nor the database', async () => {
    const store = jsonStore();
    const counter = counting(db);
    const result = await createReads(() => [], store.cache).getToursByKeys(counter.db, [], today);
    expect(result).toEqual(new Map());
    expect(store.keys).toEqual([]);
    expect(counter.queries).toBe(0);
  });

  it('getOperators: one key per option, without today', async () => {
    const store = jsonStore();
    const reads = createReads(() => [], store.cache);
    await reads.getOperators(db);
    await reads.getOperators(db, {});
    await reads.getOperators(db, { onlyWithGoodRun: false });
    await reads.getOperators(db, { onlyWithGoodRun: true });
    expect(store.keys.map(k => JSON.parse(k))).toEqual([
      { read: 'getOperators', onlyWithGoodRun: false }, { read: 'getOperators', onlyWithGoodRun: false },
      { read: 'getOperators', onlyWithGoodRun: false }, { read: 'getOperators', onlyWithGoodRun: true },
    ]);
  });

  it('a stored search is the same as asking the database, and a second identical one makes no query', async () => {
    const store = jsonStore();
    const counter = counting(db);
    const reads = createReads(() => ['taiwan-north', 'korea-seoul', 'japan-kansai'], store.cache);
    const query: SearchQuery = { ...base, sort: 'destination' };

    const first = await reads.searchTours(counter.db, query, 'en');
    const afterFirst = counter.queries;
    const second = await reads.searchTours(counter.db, query, 'en');

    expect(afterFirst).toBeGreaterThan(0);
    expect(counter.queries).toBe(afterFirst);
    expect(second).toStrictEqual(first);
    expect(first).toStrictEqual(await searchTours(db, { ...query, destinationOrder: ['taiwan-north', 'korea-seoul', 'japan-kansai'] }));
  });

  it('no sort outside the destination sorts depends on the destination order', async () => {
    const order = ['taiwan-north', 'korea-seoul', 'japan-kansai'];
    for (const sort of ['price', 'price-desc', 'days', 'days-desc', 'date', 'date-desc'] as SortKey[]) {
      const query = { ...base, sort };
      const without = await searchTours(db, query);
      expect(await searchTours(db, { ...query, destinationOrder: order })).toStrictEqual(without);
      expect(await searchTours(db, { ...query, destinationOrder: [...order].reverse() })).toStrictEqual(without);
    }
    // …while the destination sorts do, so they need the language in their key.
    const forward = await searchTours(db, { ...base, sort: 'destination', destinationOrder: order });
    const backward = await searchTours(db, { ...base, sort: 'destination', destinationOrder: [...order].reverse() });
    expect(forward.tours.map(t => t.key)).not.toEqual(backward.tours.map(t => t.key));
  });
});

describe('errors are never stored', () => {
  it('a failed read rejects with the database error itself, stores nothing, and the next call asks again', async () => {
    const error = new Error('connection refused');
    const store = jsonStore();
    const db = brokenDb(error);
    const reads = createReads(() => [], store.cache);

    for (const call of [
      () => reads.searchTours(db, base, 'zh-Hant'),
      () => reads.getOperators(db),
      () => reads.getToursByKeys(db, ['egl:KIX5'], today),
    ]) {
      const before = db.queries;
      await expect(call()).rejects.toBe(error);
      await expect(call()).rejects.toBe(error);
      expect(db.queries).toBe(before + 2); // each call went to the database
    }
    expect(store.entries.size).toBe(0);
  });

  it('after a failure, a working database fills the store and the next call is served from it', async () => {
    const error = new Error('timeout');
    const store = jsonStore();
    let down = true;
    let queries = 0;
    const db = {
      query: async () => { queries++; if (down) throw error; return [{ total: 0 }]; },
    } as unknown as Db;
    const reads = createReads(() => [], store.cache);

    await expect(reads.searchTours(db, base, 'en')).rejects.toBe(error);
    down = false;
    expect(await reads.searchTours(db, base, 'en')).toEqual({ tours: [], total: 0 });
    expect(await reads.searchTours(db, base, 'en')).toEqual({ tours: [], total: 0 });
    expect(queries).toBe(2);
    expect(store.entries.size).toBe(1);
  });
});

describe('the real cache function', () => {
  it('hands Next.js the key as the only key part, a fixed hour and the tag, and calls the result with no arguments', async () => {
    const cached = vi.fn(async () => 'value');
    unstableCache.mockReturnValue(cached);
    const load = async () => 'value';

    expect(await nextCache('{"read":"getOperators","onlyWithGoodRun":false}', load)).toBe('value');
    expect(unstableCache).toHaveBeenCalledWith(load, ['{"read":"getOperators","onlyWithGoodRun":false}'], {
      revalidate: READ_CACHE_SECONDS, tags: [READ_CACHE_TAG],
    });
    expect(cached).toHaveBeenCalledWith();
    expect(READ_CACHE_SECONDS).toBe(3600);
  });
});
