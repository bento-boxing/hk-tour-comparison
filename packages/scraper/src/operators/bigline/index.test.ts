import { afterEach, beforeEach, expect, it } from 'vitest';
import { places } from '@hktours/core';
import type { Db } from '@hktours/db';
import { createTestDb } from '@hktours/db/test';
import { runOperator } from '../../run-operator';
import type { Fetcher } from '../../types';
import { DATES_URL, detailUrl } from './discover';
import { createFetchPage, MAX_MONTHS_PER_TOUR } from './fetch-page';
import { biglineScraper } from './index';
import { rawDates, rawDetail, rawRow, SECRETS } from './test-responses';

const TODAY = '2026-11-13';

it('is registered as bigline, sending its one header only to the API host', () => {
  expect(biglineScraper.id).toBe('bigline');
  expect(biglineScraper.requestHeaders).toEqual({ 'api.biglinehk.com': { tenantCode: 'DH' } });
  expect(MAX_MONTHS_PER_TOUR).toBe(3);
});

let db: Db;
beforeEach(async () => { db = await createTestDb(); });
afterEach(async () => { await db.close(); });

it('a run over answers full of names, notes, suppliers and costs saves and logs none of them', async () => {
  // Tour 9109 answers in full; tour 9110's detail is refused (code 401), tour 9111's dates month is.
  const answers = new Map<string, unknown>([
    [detailUrl('9109'), rawDetail()],
    [detailUrl('9110'), { code: 401, msg: SECRETS[1] }],
    [detailUrl('9111'), rawDetail({ id: 9111 })],
  ]);
  const logs: string[] = [];
  const fetcher: Fetcher = {
    fetchText: async url => (answers.has(url) ? JSON.stringify(answers.get(url)) : null),
    postJson: async (url, body) => {
      const { productId, yearMonth } = body as { productId: string; yearMonth: string };
      if (url !== DATES_URL) return null;
      if (productId === '9111') return JSON.stringify({ code: 500, msg: SECRETS[2] });
      return JSON.stringify(rawDates([rawRow(`${yearMonth}-28`, { productId: Number(productId) })]));
    },
  };
  const run = (ids: string[]) => runOperator(
    {
      ...biglineScraper,
      discover: async () => ids.map(id => `https://bigline.hk/tour-group/${id}`),
      fetchPage: createFetchPage({ today: () => TODAY }),
      minExpectedTours: undefined,
    },
    { db, fetcher, index: places, today: TODAY, now: () => new Date('2026-11-13T18:00:00Z'), log: line => logs.push(line) },
  );
  expect((await run(['9109'])).toursSaved).toBe(1);
  await run(['9110', '9111']); // fails its checks: nothing fetched

  expect(logs.some(line => line.includes('tour-group/9110') && /code 401/.test(line))).toBe(true);
  expect(logs.some(line => line.includes('tour-group/9111') && /code 500/.test(line))).toBe(true);
  const saved = [];
  for (const table of ['tours', 'departures', 'tour_stops', 'price_snapshots', 'unmatched_places', 'scrape_runs']) {
    saved.push(...await db.query(`select row_to_json(t)::text as row from ${table} t`));
  }
  expect(JSON.stringify(saved)).toContain('CSIAA06'); // the good tour was saved
  const everything = `${logs.join('\n')}\n${JSON.stringify(saved)}`;
  for (const secret of SECRETS) expect(everything).not.toContain(secret);
});
