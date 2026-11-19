// @vitest-environment node
import { it, expect, beforeAll, afterAll, describe } from 'vitest';
import { places, type NormalisedTour, type OperatorId, type ScrapedDeparture, type Stop } from '@hktours/core';
import { saveOperatorRun, PAGE_SIZE, type Db } from '@hktours/db';
// The in-memory test database is imported here, in the test, never by app code.
import { createTestDb } from '@hktours/db/test';
import { createReads, type CacheFn } from './cached-reads';
import { destinationOrder, loadSearchPage } from './search-page-data';

const today = '2026-11-12';

const OSAKA: Stop = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' };
const KYOTO: Stop = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-kyoto' };
const TOKYO: Stop = { countryId: 'japan', regionId: 'japan-kanto', cityId: 'japan-kanto-tokyo' };
const HAKONE: Stop = { countryId: 'japan', regionId: 'japan-kanto', cityId: 'japan-kanto-hakone' };
const SEOUL: Stop = { countryId: 'korea', regionId: 'korea-seoul', cityId: 'korea-seoul-seoul' };

function tour(operatorId: OperatorId, code: string, stops: Stop[], days: number, departures: ScrapedDeparture[]): NormalisedTour {
  const prices = departures.map(d => d.priceHkd ?? Infinity);
  return {
    operatorId, code, url: `https://example.test/${operatorId}/${code}`, title: `${code} 團`,
    days, nights: days - 1, stops,
    start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
    fromPriceHkd: Math.min(...prices), departures,
  };
}

// Osaka first; Osaka in the middle only (the brief's 大阪 case); Osaka last; no Kansai at all.
const KIX5 = tour('egl', 'KIX5', [OSAKA, KYOTO], 5, [{ date: '2026-12-18', priceHkd: 7999 }]);
const MID = tour('jetour', 'MID6', [TOKYO, OSAKA, HAKONE], 6, [{ date: '2026-12-20', priceHkd: 9880 }]);
const LAST = tour('texpert', 'LAST4', [TOKYO, OSAKA], 4, [{ date: '2026-12-05', priceHkd: 6500 }]);
const SEL5 = tour('bigline', 'SEL5', [SEOUL], 5, [{ date: '2026-12-24', priceHkd: 5699 }]);

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
  const stats = { startedAt: new Date('2026-11-12T18:00:00Z'), finishedAt: new Date('2026-11-12T18:30:00Z'), pagesFetched: 1, parseFailures: 0 };
  const save = (operatorId: OperatorId, tours: NormalisedTour[]) =>
    saveOperatorRun(db, { operatorId, runDate: today, tours, unmatched: [], stats });
  await save('egl', [KIX5]);
  await save('jetour', [MID]);
  await save('texpert', [LAST]);
  await save('bigline', [SEL5]);
});

afterAll(async () => { await db.close(); });

const keys = (data: Awaited<ReturnType<typeof loadSearchPage>>) => data.tours.map(t => t.key);

it('an empty address lists every tour by price, with the operators', async () => {
  const data = await loadSearchPage(db, {}, today);
  expect(data.state).toEqual({ filters: {}, sort: 'price', page: 1 });
  expect(keys(data)).toEqual(['bigline:SEL5', 'texpert:LAST4', 'egl:KIX5', 'jetour:MID6']);
  expect(data.total).toBe(4);
  expect(data.operators.map(o => o.id)).toEqual(['egl', 'jetour', 'texpert', 'bigline', 'charming', 'yummy', 'sunflower', 'taste']);
  expect(data.filterOperators.map(o => o.id)).toEqual(['egl', 'jetour', 'texpert', 'bigline']); // the four that have run here
});

it('the nonsense address page=-1&sort=x&dest=<b> gives the default list', async () => {
  const raw = Object.fromEntries(new URLSearchParams('page=-1&sort=x&dest=%3Cb%3E'));
  const data = await loadSearchPage(db, raw, today);
  expect(data.state).toEqual({ filters: {}, sort: 'price', page: 1 });
  expect(keys(data)).toEqual(['bigline:SEL5', 'texpert:LAST4', 'egl:KIX5', 'jetour:MID6']);
});

it('a region matches tours that visit it at any stop, including a middle stop only', async () => {
  const data = await loadSearchPage(db, { dest: 'japan-kansai' }, today);
  expect(keys(data)).toEqual(['texpert:LAST4', 'egl:KIX5', 'jetour:MID6']);
  expect(data.total).toBe(3);
});

it('the address strings become numbers for the database: days, price and sort apply', async () => {
  const data = await loadSearchPage(db, { dest: 'japan', dmin: '5', dmax: '6', pmax: '9000', sort: 'days' }, today);
  expect(data.state.filters).toEqual({ destination: { countryId: 'japan', regionId: null }, daysMin: 5, daysMax: 6, priceMax: 9000 });
  expect(keys(data)).toEqual(['egl:KIX5']);
});

it('the date window and operators apply', async () => {
  const data = await loadSearchPage(db, { from: '2026-12-10', to: '2026-12-31', op: 'egl,jetour,wingon' }, today);
  expect(keys(data)).toEqual(['egl:KIX5', 'jetour:MID6']);
});

it('the travel window applies, and the cards list only the departures that fit', async () => {
  // KIX5 (5 days, 12-18) is back on 12-22 and MID6 (6 days, 12-20) on 12-25; SEL5 (12-24) only on 12-28.
  const data = await loadSearchPage(db, { tfrom: '2026-12-18', tto: '2026-12-25' }, today);
  expect(data.state.filters).toEqual({ travelFrom: '2026-12-18', travelTo: '2026-12-25' });
  expect(data.tours.map(t => [t.key, t.departures.map(d => d.date)])).toEqual([
    ['egl:KIX5', ['2026-12-18']], ['jetour:MID6', ['2026-12-20']],
  ]);
});

it('a travel window nothing fits gives an empty list, not an error', async () => {
  for (const raw of [{ tfrom: '2026-12-18', tto: '2026-12-19' }, { tto: '2026-01-31' }]) {
    const data = await loadSearchPage(db, raw, today);
    expect(data.total, JSON.stringify(raw)).toBe(0);
    expect(data.tours).toEqual([]);
  }
});

it('a travel window that ends before it starts is dropped, as a reversed departure window is: the full list', async () => {
  const data = await loadSearchPage(db, { tfrom: '2026-12-25', tto: '2026-12-18' }, today);
  expect(data.state.filters).toEqual({});
  expect(data.total).toBe(4);
});

describe('odd dates in the address never reach the database as an error', () => {
  // Each passes or fails isIsoDate differently: year 0 (Postgres has none), the last day of year 9999,
  // a five-digit year, 30 February, month 13, and the first day of year 1.
  const dates = ['0000-01-01', '9999-12-31', '10000-01-01', '2027-02-30', '2027-13-01', '0001-01-01'];
  it.each(['from', 'to', 'tfrom', 'tto'])('%s', async name => {
    for (const text of dates) {
      const data = await loadSearchPage(db, { [name]: text }, today);
      expect(data.tours.length, `${name}=${text}`).toBe(data.total);
    }
    // Year 0 is dropped, so the whole list shows; 9999-12-31 is kept and is a valid bound.
    expect((await loadSearchPage(db, { [name]: '0000-01-01' }, today)).total).toBe(4);
    expect((await loadSearchPage(db, { [name]: '9999-12-31' }, today)).state.filters).not.toEqual({});
  });
});

// LAST4 and MID6 both start in Kanto (Tokyo): the cheaper one comes first in both directions.
it.each([
  // 日本 (4 strokes) · 關西 (關 19, 西 6) before 關東 (東 8), then 韓國 (17 strokes).
  ['zh-Hant', ['egl:KIX5', 'texpert:LAST4', 'jetour:MID6', 'bigline:SEL5'], ['bigline:SEL5', 'texpert:LAST4', 'jetour:MID6', 'egl:KIX5']],
  // 韩国 (hán) before 日本 (rì); 关东 (dōng) before 关西 (xī).
  ['zh-Hans', ['bigline:SEL5', 'texpert:LAST4', 'jetour:MID6', 'egl:KIX5'], ['egl:KIX5', 'texpert:LAST4', 'jetour:MID6', 'bigline:SEL5']],
  // Japan · Kansai, Japan · Kanto, South Korea.
  ['en', ['egl:KIX5', 'texpert:LAST4', 'jetour:MID6', 'bigline:SEL5'], ['bigline:SEL5', 'texpert:LAST4', 'jetour:MID6', 'egl:KIX5']],
] as const)('%s: the destination sorts follow the names the visitor reads, by first region', async (locale, ascending, descending) => {
  expect(keys(await loadSearchPage(db, { sort: 'destination' }, today, locale))).toEqual(ascending);
  expect(keys(await loadSearchPage(db, { sort: 'destination-desc' }, today, locale))).toEqual(descending);
});

describe('destinationOrder', () => {
  const at = (order: string[], ids: string[]) => ids.map(id => order.indexOf(id));
  const increasing = (xs: number[]) => xs.every((x, i) => x >= 0 && (i === 0 || x > xs[i - 1]));

  it('lists every region once', () => {
    for (const locale of ['zh-Hant', 'zh-Hans', 'en'] as const) {
      const order = destinationOrder(places, locale);
      expect(order).toHaveLength(places.data.regions.length);
      expect(new Set(order)).toEqual(new Set(places.data.regions.map(r => r.id)));
    }
  });

  it('Traditional Chinese is by stroke count: 日本, 台灣, 韓國; 北海道, 關西, 關東', () => {
    expect(increasing(at(destinationOrder(places, 'zh-Hant'),
      ['japan-hokkaido', 'japan-kansai', 'japan-kanto', 'taiwan-north', 'korea-seoul']))).toBe(true);
  });

  it('Simplified Chinese is by pinyin: 韩国, 日本, 台湾; 北海道, 关东, 关西', () => {
    expect(increasing(at(destinationOrder(places, 'zh-Hans'),
      ['korea-seoul', 'japan-hokkaido', 'japan-kanto', 'japan-kansai', 'taiwan-north']))).toBe(true);
  });

  it('English is A to Z: Japan, South Korea, Taiwan; Hokkaido, Kansai, Kanto', () => {
    expect(increasing(at(destinationOrder(places, 'en'),
      ['japan-hokkaido', 'japan-kansai', 'japan-kanto', 'korea-seoul', 'taiwan-north']))).toBe(true);
  });
});

it('an exclusion in the address is ignored on the search page, which has no control to remove it', async () => {
  const data = await loadSearchPage(db, { ex: 'japan' }, today);
  expect(data.state.filters).toEqual({});
  expect(data.total).toBe(4);
});

it('a page beyond the last gives no tours but still the total', async () => {
  const data = await loadSearchPage(db, { page: '2' }, today);
  expect(PAGE_SIZE).toBeGreaterThan(4);
  expect(data.state.page).toBe(2);
  expect(data.tours).toEqual([]);
  expect(data.total).toBe(4);
});

it('a database error is passed to the caller', async () => {
  const broken: Db = { ...db, query: () => Promise.reject(new Error('connection refused')) };
  await expect(loadSearchPage(broken, {}, today)).rejects.toThrow('connection refused');
});

describe('the operator filter', () => {
  // Only Jetour and Travel Expert have ever had a good run, as at launch.
  let launch: Db;
  beforeAll(async () => {
    launch = await createTestDb();
    const stats = { startedAt: new Date('2026-11-12T18:00:00Z'), finishedAt: new Date('2026-11-12T18:30:00Z'), pagesFetched: 1, parseFailures: 0 };
    await saveOperatorRun(launch, { operatorId: 'jetour', runDate: today, tours: [MID], unmatched: [], stats });
    await saveOperatorRun(launch, { operatorId: 'texpert', runDate: today, tours: [LAST], unmatched: [], stats });
  });
  afterAll(async () => { await launch.close(); });

  it('offers only operators that have had a good run; every operator stays available for lookups', async () => {
    const data = await loadSearchPage(launch, {}, today);
    expect(data.filterOperators.map(o => o.id)).toEqual(['jetour', 'texpert']);
    expect(data.operators.map(o => o.id)).toEqual(['egl', 'jetour', 'texpert', 'bigline', 'charming', 'yummy', 'sunflower', 'taste']);
  });

  it('an operator the address selects stays offered, so the selection can be seen and undone', async () => {
    const data = await loadSearchPage(launch, { op: 'bigline,texpert' }, today);
    expect(data.state.filters.operators).toEqual(['texpert', 'bigline']);
    expect(data.filterOperators.map(o => o.id)).toEqual(['jetour', 'texpert', 'bigline']);
    expect(keys(data)).toEqual(['texpert:LAST4']);
  });
});

describe('through a cache (the pages pass cachedReads; see cached-reads.ts)', () => {
  /** Stores values as JSON text, as Next's data cache does; a load that throws stores nothing. */
  function jsonStore() {
    const entries = new Map<string, string>();
    const cache: CacheFn = async (key, load) => {
      const hit = entries.get(key);
      if (hit !== undefined) return JSON.parse(hit);
      const value = await load();
      entries.set(key, JSON.stringify(value));
      return value;
    };
    return { cache, entries };
  }
  const counting = (inner: Db) => {
    const counter = {
      queries: 0,
      db: { ...inner, query: (sql: string, params?: unknown[]) => { counter.queries++; return inner.query(sql, params); } } as Db,
    };
    return counter;
  };
  const readsWith = (cache: CacheFn) => createReads(locale => destinationOrder(places, locale), cache);

  it('a second identical search makes no query, a different filter does, and both match the uncached page', async () => {
    const reads = readsWith(jsonStore().cache);
    const counter = counting(db);

    const first = await loadSearchPage(counter.db, { dest: 'japan', op: 'jetour,egl' }, today, 'en', reads);
    const afterFirst = counter.queries;
    // The same search, written differently in the address, in another language (the price sort ignores it).
    const again = await loadSearchPage(counter.db, { op: 'egl,jetour,egl', dest: 'japan', page: '1' }, today, 'zh-Hans', reads);
    expect(afterFirst).toBeGreaterThan(0);
    expect(counter.queries).toBe(afterFirst);
    expect(again).toStrictEqual(first);
    expect(first).toStrictEqual(await loadSearchPage(db, { dest: 'japan', op: 'jetour,egl' }, today, 'en'));

    const other = await loadSearchPage(counter.db, { dest: 'korea' }, today, 'en', reads);
    expect(counter.queries).toBeGreaterThan(afterFirst);
    expect(keys(other)).toEqual(['bigline:SEL5']);
  });

  it('a destination sort is stored per language: no language gets another one\'s order', async () => {
    const reads = readsWith(jsonStore().cache); // one store for all three languages
    const orders: string[][] = [];
    for (const locale of ['zh-Hant', 'zh-Hans', 'en', 'zh-Hans'] as const) {
      const cached = keys(await loadSearchPage(db, { sort: 'destination' }, today, locale, reads));
      expect(cached).toEqual(keys(await loadSearchPage(db, { sort: 'destination' }, today, locale)));
      orders.push(cached);
    }
    // The languages really differ here (Korea comes first only in pinyin), so the check means something.
    expect(orders[1]).not.toEqual(orders[0]);
  });

  it('a database error reaches the caller unchanged and is not stored: the next load asks again', async () => {
    const store = jsonStore();
    const reads = readsWith(store.cache);
    const error = new Error('connection refused');
    let down = true;
    const flaky: Db = { ...db, query: (sql, params) => (down ? Promise.reject(error) : db.query(sql, params)) };

    await expect(loadSearchPage(flaky, {}, today, 'zh-Hant', reads)).rejects.toBe(error);
    expect(store.entries.size).toBe(0);
    down = false;
    expect(keys(await loadSearchPage(flaky, {}, today, 'zh-Hant', reads)))
      .toEqual(['bigline:SEL5', 'texpert:LAST4', 'egl:KIX5', 'jetour:MID6']);
    expect(store.entries.size).toBe(3); // the search and the two operator lists
  });
});
