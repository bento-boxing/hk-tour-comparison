// @vitest-environment node
import { it, expect, beforeAll, afterAll, describe } from 'vitest';
import type { NormalisedTour, OperatorId, ScrapedDeparture, Stop } from '@hktours/core';
import { saveOperatorRun, PAGE_SIZE, type Db } from '@hktours/db';
// The in-memory test database is imported here, in the test, never by app code.
import { createTestDb } from '@hktours/db/test';
import { loadSearchPage } from './search-page-data';

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
  expect(data.operators.map(o => o.id)).toEqual(['egl', 'jetour', 'texpert', 'bigline']);
  expect(data.filterOperators.map(o => o.id)).toEqual(['egl', 'jetour', 'texpert', 'bigline']); // all four have run here
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
    expect(data.operators.map(o => o.id)).toEqual(['egl', 'jetour', 'texpert', 'bigline']);
  });

  it('an operator the address selects stays offered, so the selection can be seen and undone', async () => {
    const data = await loadSearchPage(launch, { op: 'bigline,texpert' }, today);
    expect(data.state.filters.operators).toEqual(['texpert', 'bigline']);
    expect(data.filterOperators.map(o => o.id)).toEqual(['jetour', 'texpert', 'bigline']);
    expect(keys(data)).toEqual(['texpert:LAST4']);
  });
});
