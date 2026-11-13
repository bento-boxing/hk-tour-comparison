// @vitest-environment node
import { it, expect, beforeAll, afterAll, describe } from 'vitest';
import { MAX_CHAIN_LEGS, type NormalisedTour, type OperatorId, type ScrapedDeparture, type Stop } from '@hktours/core';
import { saveOperatorRun, type Db } from '@hktours/db';
// The in-memory test database is imported here, in the test, never by app code.
import { createTestDb } from '@hktours/db/test';
import { loadChainPage, type ChainPageData } from './chain-page-data';
import { chainPageHref } from './chain-href';

const today = '2026-11-12';

const OSAKA: Stop = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' };
const TOKYO: Stop = { countryId: 'japan', regionId: 'japan-kanto', cityId: 'japan-kanto-tokyo' };
const SEOUL: Stop = { countryId: 'korea', regionId: 'korea-seoul', cityId: 'korea-seoul-seoul' };
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

// The brief's A, B and C, plus two more: OSA6 inside the 1–3 day window after A, FAR after the A+B chain.
const KIX5 = tour('egl', 'KIX5', [OSAKA], 5, [{ date: '2026-12-18', priceHkd: 7999 }, { date: '2026-12-27', priceHkd: 8999 }]);
const SEL5 = tour('texpert', 'SEL5', [SEOUL], 5, [{ date: '2026-12-24', priceHkd: 5699 }, { date: '2026-12-25', priceHkd: null }]);
const TPE4 = tour('bigline', 'TPE4', [TAIPEI], 4, [{ date: '2026-12-23', priceHkd: 3980 }]);
const OSA6 = tour('jetour', 'OSA6', [OSAKA], 6, [{ date: '2026-12-20', priceHkd: 7000 }, { date: '2026-12-25', priceHkd: 8499 }, { date: '2026-12-26', priceHkd: 8800 }]);
const FAR = tour('jetour', 'FAR4', [TOKYO], 4, [{ date: '2026-12-30', priceHkd: 9000 }]);
// One-day trips every other day from 4 January, after every other test's window, for the leg limit.
const dayTrip = (i: number) => `2027-01-${String(4 + 2 * i).padStart(2, '0')}`;
const DAY1 = tour('bigline', 'DAY1', [TAIPEI], 1, Array.from({ length: 12 }, (_, i) => ({ date: dayTrip(i), priceHkd: 100 })));

const stats = { startedAt: new Date('2026-11-12T18:00:00Z'), finishedAt: new Date('2026-11-12T18:30:00Z'), pagesFetched: 1, parseFailures: 0 };
const save = (db: Db, operatorId: OperatorId, tours: NormalisedTour[]) =>
  saveOperatorRun(db, { operatorId, runDate: today, tours, unmatched: [], stats });

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
  await save(db, 'egl', [KIX5]);
  await save(db, 'jetour', [OSA6, FAR]);
  await save(db, 'texpert', [SEL5]);
  await save(db, 'bigline', [TPE4, DAY1]);
});

afterAll(async () => { await db.close(); });

const query = (text: string) => Object.fromEntries(new URLSearchParams(text));
const nextKeys = (data: ChainPageData) => data.next?.tours.map(t => t.key);
const legKeys = (data: ChainPageData) => data.legs.map(l => `${l.tour.key}@${l.departure}`);

it('an empty address has no legs and no list, with the operators', async () => {
  const data = await loadChainPage(db, {}, today);
  expect(data).toMatchObject({ legs: [], droppedCount: 0, departWindow: null, next: null, full: false });
  expect(data.address).toEqual({ chain: { legs: [], gap: { min: 1, max: 3 } }, search: { filters: {}, sort: 'price', page: 1 } });
  expect(data.operators.map(o => o.id)).toEqual(['egl', 'jetour', 'texpert', 'bigline']);
  expect(data.filterOperators.map(o => o.id)).toEqual(['egl', 'jetour', 'texpert', 'bigline']); // all four have run here
});

it('a valid two-leg chain resolves, with the tours that can follow it', async () => {
  const data = await loadChainPage(db, query('legs=egl:KIX5@2026-12-18,texpert:SEL5@2026-12-25&gap=1-3'), today);
  expect(legKeys(data)).toEqual(['egl:KIX5@2026-12-18', 'texpert:SEL5@2026-12-25']);
  expect(data.droppedCount).toBe(0);
  // The unpriced 12-25 departure takes the stored from-price and is not exact.
  expect(data.legs.map(l => [l.endDate, l.priceHkd, l.priceIsExact, l.gapBefore])).toEqual([
    ['2026-12-22', 7999, true, null], ['2026-12-29', 5699, false, 2],
  ]);
  expect(data.departWindow).toEqual({ from: '2026-12-31', to: '2027-01-02' });
  expect(data.next).toEqual({ tours: [], total: 0 });
  const earlier = await loadChainPage(db, query('legs=egl:KIX5@2026-12-18,texpert:SEL5@2026-12-24&gap=1-3'), today);
  expect(earlier.departWindow).toEqual({ from: '2026-12-30', to: '2027-01-01' });
  expect(nextKeys(earlier)).toEqual(['jetour:FAR4']);
});

it('the window for the next leg follows the gap definition: a tour ending on the 22nd with gap 1–3 gives the 24th to the 26th', async () => {
  const data = await loadChainPage(db, query('legs=egl:KIX5@2026-12-18&gap=1-3'), today);
  expect(data.legs[0].endDate).toBe('2026-12-22');
  expect(data.departWindow).toEqual({ from: '2026-12-24', to: '2026-12-26' });
  expect(nextKeys(data)).toEqual(['texpert:SEL5', 'jetour:OSA6']); // by price
  expect(data.next?.total).toBe(2);
  // Each card lists only the departures inside the window, and its price is the window's.
  const [sel, osa] = data.next!.tours;
  expect(sel.departures.map(d => d.date)).toEqual(['2026-12-24', '2026-12-25']);
  expect(osa.departures.map(d => d.date)).toEqual(['2026-12-25', '2026-12-26']);
  expect(osa.windowPriceHkd).toBe(8499);
});

it('gap 0–0 gives the day after the last leg ends: the 23rd', async () => {
  const data = await loadChainPage(db, query('legs=egl:KIX5@2026-12-18&gap=0-0'), today);
  expect(data.departWindow).toEqual({ from: '2026-12-23', to: '2026-12-23' });
  expect(nextKeys(data)).toEqual(['bigline:TPE4']);
});

it('an excluded country drops its tours from the list', async () => {
  const data = await loadChainPage(db, query('legs=egl:KIX5@2026-12-18&gap=1-3&ex=japan'), today);
  expect(data.address.search.filters).toEqual({ excludeCountryIds: ['japan'] });
  expect(nextKeys(data)).toEqual(['texpert:SEL5']);
});

it('the other filters, sort and page apply to the list; dates in the address are ignored', async () => {
  const data = await loadChainPage(db, query('legs=egl:KIX5@2026-12-18&gap=1-3&op=jetour&sort=days&from=2026-12-01&to=2026-12-02'), today);
  expect(data.address.search).toEqual({ filters: { operators: ['jetour'] }, sort: 'days', page: 1 });
  expect(nextKeys(data)).toEqual(['jetour:OSA6']);
  const page2 = await loadChainPage(db, query('legs=egl:KIX5@2026-12-18&page=2'), today);
  expect(page2.next).toEqual({ tours: [], total: 2 });
});

it('the address the page links from is built from validated state only', async () => {
  const data = await loadChainPage(db, query('legs=egl:KIX5@2026-12-18,egl:NOPE@2026-12-30&gap=3-1&ex=japan,mars&dest=<b>&page=x'), today);
  expect(data.address).toEqual({
    chain: { legs: [{ tourKey: 'egl:KIX5', departure: '2026-12-18' }], gap: { min: 1, max: 3 } },
    search: { filters: { excludeCountryIds: ['japan'] }, sort: 'price', page: 1 },
  });
  expect(chainPageHref(data.address)).toBe('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3&ex=japan');
});

it.each([
  ['legs=egl:NOPE@2026-12-18', 'an unknown tour', 1],
  ['legs=egl:KIX5@2026-12-19', 'a date the tour does not offer', 1],
  ['legs=egl:KIX5@2026-11-01', 'a departure before today', 1],
  // Legs that decodeChain cannot read count as dropped too, so the visitor sees the notice.
  ['legs=%%%', 'garbage', 1],
  ['legs=egl:KIX5@2026-02-30', 'an impossible date', 1],
  ['legs=', 'an empty value', 0],
  ['legs=,', 'only a comma', 0],
])('the hand-broken address %s (%s) gives no legs and no list', async (text, _, dropped) => {
  const data = await loadChainPage(db, query(text), today);
  expect(data).toMatchObject({ legs: [], droppedCount: dropped, departWindow: null, next: null, full: false });
  expect(data.address.chain.legs).toEqual([]);
});

it.each([
  ['gap=9-2', { min: 2, max: 9 }, { from: '2026-12-25', to: '2027-01-01' }],
  ['gap=abc', { min: 1, max: 3 }, { from: '2026-12-24', to: '2026-12-26' }],
  ['gap=-1-5', { min: 1, max: 3 }, { from: '2026-12-24', to: '2026-12-26' }],
  ['gap=0-99', { min: 0, max: 30 }, { from: '2026-12-23', to: '2027-01-22' }],
])('the hand-broken %s falls back to a valid gap', async (gapText, gap, departWindow) => {
  const data = await loadChainPage(db, query(`legs=egl:KIX5@2026-12-18&${gapText}`), today);
  expect(data.address.chain.gap).toEqual(gap);
  expect(data.departWindow).toEqual(departWindow);
  expect(data.legs).toHaveLength(1);
});

it('a leg decodeChain cannot read is dropped with the legs after it, and counted for the notice', async () => {
  const data = await loadChainPage(db, query('legs=egl:KIX5@2026-12-18,egl:BAD CODE@2026-12-24,texpert:SEL5@2026-12-24'), today);
  expect(legKeys(data)).toEqual(['egl:KIX5@2026-12-18']);
  expect(data.droppedCount).toBe(2);
  expect(data.address.chain.legs).toEqual([{ tourKey: 'egl:KIX5', departure: '2026-12-18' }]);
});

it('cut-off legs and legs resolveChain drops add up', async () => {
  const data = await loadChainPage(db, query('legs=egl:KIX5@2026-12-18,egl:NOPE@2026-12-24,junk,texpert:SEL5@2026-12-24'), today);
  expect(legKeys(data)).toEqual(['egl:KIX5@2026-12-18']);
  expect(data.droppedCount).toBe(3); // NOPE by resolveChain; junk and SEL5 cut off by decodeChain
});

it('garbage after a valid leg keeps the leg and shows the notice', async () => {
  const data = await loadChainPage(db, query('legs=egl:KIX5@2026-12-18,%%%'), today);
  expect(legKeys(data)).toEqual(['egl:KIX5@2026-12-18']);
  expect(data.droppedCount).toBe(1);
});

it('a trailing comma is not a dropped leg', async () => {
  const data = await loadChainPage(db, query('legs=egl:KIX5@2026-12-18,'), today);
  expect(legKeys(data)).toEqual(['egl:KIX5@2026-12-18']);
  expect(data.droppedCount).toBe(0);
});

it('a repeated parameter uses its first value', async () => {
  const data = await loadChainPage(db, { legs: ['egl:KIX5@2026-12-18', 'texpert:SEL5@2026-12-24'], gap: ['0-0', '5-5'] }, today);
  expect(legKeys(data)).toEqual(['egl:KIX5@2026-12-18']);
  expect(data.droppedCount).toBe(0);
  expect(data.address.chain.gap).toEqual({ min: 0, max: 0 });
});

it(`a chain of ${MAX_CHAIN_LEGS} legs is full: no window and no list; more legs in the address are ignored`, async () => {
  const dates = Array.from({ length: MAX_CHAIN_LEGS + 1 }, (_, i) => dayTrip(i));
  const legs = dates.map(d => `bigline:DAY1@${d}`).join(',');
  const data = await loadChainPage(db, query(`legs=${legs}&gap=0-0`), today);
  expect(data.legs).toHaveLength(MAX_CHAIN_LEGS);
  expect(data.droppedCount).toBe(0); // legs past the limit are ignored, not reported
  const garbageTail = await loadChainPage(db, query(`legs=${legs},%%%&gap=0-0`), today);
  expect(garbageTail).toMatchObject({ droppedCount: 0, full: true });
  expect(data).toMatchObject({ full: true, departWindow: null, next: null });
  const shorter = await loadChainPage(db, query(`legs=${dates.slice(0, MAX_CHAIN_LEGS - 1).map(d => `bigline:DAY1@${d}`).join(',')}&gap=0-0`), today);
  expect(shorter).toMatchObject({ full: false, departWindow: { from: '2027-01-17', to: '2027-01-17' } });
  expect(nextKeys(shorter)).toEqual([]);
});

it('a database error is passed to the caller', async () => {
  const broken: Db = { ...db, query: () => Promise.reject(new Error('connection refused')) };
  await expect(loadChainPage(broken, query('legs=egl:KIX5@2026-12-18'), today)).rejects.toThrow('connection refused');
  await expect(loadChainPage(broken, {}, today)).rejects.toThrow('connection refused');
});

describe('a leg whose tour has since been deactivated', () => {
  let later: Db;
  beforeAll(async () => {
    later = await createTestDb();
    await save(later, 'egl', [KIX5]);
    await save(later, 'texpert', [SEL5]);
    await save(later, 'jetour', [FAR]);
    // The next texpert run no longer lists SEL5, so it is marked inactive.
    await save(later, 'texpert', [tour('texpert', 'OTHER', [SEOUL], 3, [{ date: '2027-01-10', priceHkd: 3000 }])]);
  });
  afterAll(async () => { await later.close(); });

  it('is dropped with everything after it; earlier legs stay and the page goes on from them', async () => {
    const data = await loadChainPage(later, query('legs=egl:KIX5@2026-12-18,texpert:SEL5@2026-12-24,jetour:FAR4@2026-12-30&gap=1-3'), today);
    expect(legKeys(data)).toEqual(['egl:KIX5@2026-12-18']);
    expect(data.droppedCount).toBe(2);
    expect(data.address.chain.legs).toEqual([{ tourKey: 'egl:KIX5', departure: '2026-12-18' }]);
    expect(data.departWindow).toEqual({ from: '2026-12-24', to: '2026-12-26' });
    expect(data.next).toEqual({ tours: [], total: 0 });
  });
});

describe('the operator filter', () => {
  // Only Jetour and Travel Expert have ever had a good run, as at launch.
  let launch: Db;
  beforeAll(async () => {
    launch = await createTestDb();
    await save(launch, 'jetour', [OSA6, FAR]);
    await save(launch, 'texpert', [SEL5]);
  });
  afterAll(async () => { await launch.close(); });

  it('offers only operators that have had a good run; every operator stays available for lookups', async () => {
    const data = await loadChainPage(launch, query('legs=jetour:OSA6@2026-12-20&gap=1-3'), today);
    expect(legKeys(data)).toEqual(['jetour:OSA6@2026-12-20']);
    expect(data.filterOperators.map(o => o.id)).toEqual(['jetour', 'texpert']);
    expect(data.operators.map(o => o.id)).toEqual(['egl', 'jetour', 'texpert', 'bigline']);
  });

  it('an operator the address selects stays offered, so the selection can be seen and undone', async () => {
    const data = await loadChainPage(launch, query('legs=jetour:OSA6@2026-12-20&gap=1-3&op=egl'), today);
    expect(data.address.search.filters.operators).toEqual(['egl']);
    expect(data.filterOperators.map(o => o.id)).toEqual(['egl', 'jetour', 'texpert']);
  });
});
