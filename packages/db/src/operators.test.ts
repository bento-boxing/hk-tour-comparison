import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OPERATOR_IDS, type IsoDate, type NormalisedTour, type OperatorId, type Stop } from '@hktours/core';
import type { Db } from './db';
import { createTestDb } from './test-db';
import { saveOperatorRun } from './save-run';
import { getOperatorListings } from './operators';
import { getOperators, searchTours } from './search';

const today: IsoDate = '2026-11-12';

const OSAKA: Stop = { countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' };
const TOKYO: Stop = { countryId: 'japan', regionId: 'japan-kanto', cityId: 'japan-kanto-tokyo' };
const SEOUL: Stop = { countryId: 'korea', regionId: 'korea-seoul', cityId: 'korea-seoul-seoul' };
const TAIPEI: Stop = { countryId: 'taiwan', regionId: 'taiwan-north', cityId: null };

function tour(operatorId: OperatorId, code: string, stops: Stop[], dates: IsoDate[]): NormalisedTour {
  return {
    operatorId, code, url: `https://example.test/${operatorId}/${code}`, title: `${code} 團`,
    days: 5, nights: 4, stops,
    start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
    fromPriceHkd: 5000, departures: dates.map(date => ({ date, priceHkd: 5000 })),
  };
}

async function save(db: Db, operatorId: OperatorId, tours: NormalisedTour[], finishedAt = '2026-11-12T18:00:00.000Z') {
  await saveOperatorRun(db, {
    operatorId, runDate: today, tours, unmatched: [],
    stats: { startedAt: new Date('2026-11-12T17:00:00.000Z'), finishedAt: new Date(finishedAt), pagesFetched: 1, parseFailures: 0 },
  });
}

describe('getOperatorListings', () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
    await save(db, 'egl', [
      tour('egl', 'KIX', [OSAKA], ['2026-12-01']),
      tour('egl', 'TYOKIX', [TOKYO, OSAKA], ['2026-12-02']), // two stops in one country: counted once there
      tour('egl', 'JPKR', [TOKYO, SEOUL], ['2026-12-03']), // two countries: once in each
      tour('egl', 'GONE', [SEOUL], ['2026-11-12']), // its only departure is today: not listed
      tour('egl', 'DROPPED', [TAIPEI], ['2026-12-03']),
    ]);
    await save(db, 'egl', [
      tour('egl', 'KIX', [OSAKA], ['2026-12-01']),
      tour('egl', 'TYOKIX', [TOKYO, OSAKA], ['2026-12-02']),
      tour('egl', 'JPKR', [TOKYO, SEOUL], ['2026-12-03']),
      tour('egl', 'GONE', [SEOUL], ['2026-11-12']),
    ], '2026-11-12T19:00:00.000Z'); // egl:DROPPED is no longer offered: inactive
    await save(db, 'jetour', [
      tour('jetour', 'TPE', [TAIPEI], ['2026-12-05']),
      tour('jetour', 'NOWHERE', [], ['2027-01-11']), // no stops: counted in the operator's total only
    ]);
    // A good run whose only tour leaves today: texpert lists nothing now, but the site knows it.
    await save(db, 'texpert', [tour('texpert', 'TODAY', [SEOUL], ['2026-11-12'])]);
  });
  afterAll(async () => { await db.close(); });

  it('gives every operator that has had a good run, in the canonical order, with its names, colour, home address, last good run and listed tours', async () => {
    const listings = await getOperatorListings(db, today);
    // The five operators never run (bigline, charming, yummy, sunflower, taste) do not exist for the site yet.
    expect(listings.map(o => o.id)).toEqual(['egl', 'jetour', 'texpert']);
    expect(listings[0]).toEqual({
      id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', siteUrl: 'https://www.egltours.com',
      lastGoodRunAt: '2026-11-12T19:00:00.000Z',
      tours: 3,
      // Most tours first; a tour in two countries counts in each.
      countries: [{ countryId: 'japan', tours: 3 }, { countryId: 'korea', tours: 1 }],
    });
    expect(listings[1]).toMatchObject({ id: 'jetour', tours: 2, countries: [{ countryId: 'taiwan', tours: 1 }] });
    // A good run but nothing listed now: there, with 0.
    expect(listings[2]).toMatchObject({ id: 'texpert', tours: 0, countries: [], lastGoodRunAt: '2026-11-12T18:00:00.000Z' });
  });

  it('leaves out a row the code does not know (no page could show it)', async () => {
    const extra = await createTestDb();
    try {
      await extra.query(`update operators set last_good_run_at = now()`);
      await extra.query(`insert into operators (id, name_zh, name_en, site_url, color, last_good_run_at) values ('unknown', '未知', 'Unknown', 'https://example.test', '#000000', now())`);
      expect((await getOperatorListings(extra, today)).map(o => o.id)).toEqual([...OPERATOR_IDS]);
    } finally {
      await extra.close();
    }
  });

  it('carries the same operator fields as getOperators, for the same operators as its onlyWithGoodRun', async () => {
    const listings = await getOperatorListings(db, today);
    const operators = await getOperators(db, { onlyWithGoodRun: true });
    expect(listings.map(({ id, nameZh, nameEn, color, lastGoodRunAt }) => ({ id, nameZh, nameEn, color, lastGoodRunAt }))).toEqual(operators);
  });

  it('agrees with the search: each operator\'s count is the total of its unfiltered search, and each country\'s the total with that destination', async () => {
    const total = async (operatorId: OperatorId, countryId?: string) => (await searchTours(db, {
      filters: { operators: [operatorId], ...(countryId && { destination: { countryId, regionId: null } }) }, sort: 'price', page: 1, today,
    })).total;
    for (const o of await getOperatorListings(db, today)) {
      expect(o.tours, o.id).toBe(await total(o.id));
      for (const c of o.countries) expect(c.tours, `${o.id}/${c.countryId}`).toBe(await total(o.id, c.countryId));
    }
  });

  it('ties between countries go by id, so the order never depends on the database', async () => {
    const tied = await createTestDb();
    try {
      await save(tied, 'texpert', [tour('texpert', 'A', [TAIPEI], ['2026-12-01']), tour('texpert', 'B', [SEOUL], ['2026-12-01'])]);
      expect((await getOperatorListings(tied, today)).find(o => o.id === 'texpert')!.countries.map(c => c.countryId)).toEqual(['korea', 'taiwan']);
    } finally {
      await tied.close();
    }
  });

  it('uses today: a later day lists fewer', async () => {
    const later = await getOperatorListings(db, '2026-12-02');
    expect(later.find(o => o.id === 'egl')).toMatchObject({ tours: 1, countries: [{ countryId: 'japan', tours: 1 }, { countryId: 'korea', tours: 1 }] });
  });

  it('is one statement', async () => {
    let n = 0;
    const counting: Db = { ...db, query: (sql, params) => { n++; return db.query(sql, params); } };
    await getOperatorListings(counting, today);
    expect(n).toBe(1);
  });
});
