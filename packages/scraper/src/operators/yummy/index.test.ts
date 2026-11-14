import { afterEach, beforeEach, expect, it } from 'vitest';
import { places } from '@hktours/core';
import type { Db } from '@hktours/db';
import { createTestDb } from '@hktours/db/test';
import { runOperator } from '../../run-operator';
import type { Fetcher } from '../../types';
import { datesUrl, detailUrl, LISTING_URL } from './discover';
import { yummyScraper } from './index';
import { rawDates, rawDetail, rawGroup, rawListing, rawListingRow, SECRET_COUNT, SECRETS } from './test-responses';

const TODAY = '2026-11-14';
const page = (id: number) => `https://www.yummyholiday.net/#/pages/detail/detail?id=${id}`;

it('is registered as yummy, with a provisional first-run floor and no extra request headers', () => {
  expect(yummyScraper.id).toBe('yummy');
  expect(yummyScraper.requestHeaders).toBeUndefined(); // no extra headers of any kind
  expect(yummyScraper.fetchPage).toBeDefined();
  expect(yummyScraper.minExpectedTours).toBe(196); // 60% of the 327 listed tours, until a measured crawl
});

it('throws its reason for a page it rejects, so the run\'s log says why', () => {
  expect(() => yummyScraper.parse('<html></html>', page(5906))).toThrow('not the joined detail and dates text');
});

let db: Db;
beforeEach(async () => { db = await createTestDb(); });
afterEach(async () => { await db.close(); });

it('a run requests only the listing, then each tour\'s detail and dates, by GET, and keeps none of the booking counts or prose', async () => {
  const answers = new Map<string, unknown>([
    [LISTING_URL, rawListing([rawListingRow(5906), rawListingRow(5662), rawListingRow(6033)])],
    [detailUrl('5906'), rawDetail()],
    [datesUrl('5906'), rawDates([rawGroup('2026-12-10'), rawGroup('2026-12-17', { group_enroll_status: 4 })])],
    [detailUrl('5662'), rawDetail({ id: 5662, code: 'BG-R-ET02', name: '佛岡純玩2天', daycount: 2, price: 699, dist_list: '清遠' })],
    [datesUrl('5662'), rawDates([rawGroup('2026-12-03', { line_id: 5662, price: 699 })])],
    [detailUrl('6033'), rawDetail({ id: 6033, code: 'KL-Y-BL08', name: '雲南8天', daycount: 8 })],
    [datesUrl('6033'), rawDates([rawGroup('2026-12-08', { group_enroll_status: 9 })])], // an unknown status
  ]);
  const asked: string[] = [];
  const fetcher: Fetcher = {
    fetchText: async url => {
      asked.push(url);
      return answers.has(url) ? JSON.stringify(answers.get(url)) : null;
    },
    postJson: async url => { throw new Error(`POSTed ${url}`); },
  };
  const logs: string[] = [];
  const outcome = await runOperator(
    { ...yummyScraper, minExpectedTours: undefined },
    { db, fetcher, index: places, today: TODAY, now: () => new Date('2026-11-14T00:00:00Z'), log: line => logs.push(line) },
  );

  // Only the three allowed paths, each tour's two in turn; never a staff endpoint, a POST, an image or a PDF.
  expect(asked).toEqual([
    LISTING_URL, detailUrl('5906'), datesUrl('5906'), detailUrl('5662'), datesUrl('5662'), detailUrl('6033'), datesUrl('6033'),
  ]);
  const allowed = /^https:\/\/api\.yummyholiday\.net\/bussiness\/(?:line\/index\?limit=500|line\/detail\?id=\d+|group\/list\?line_id=\d+)$/;
  for (const url of asked) expect(url).toMatch(allowed);

  expect(outcome).toMatchObject({ operatorId: 'yummy', ok: false, reasons: ['too-many-parse-failures'] }); // 1 of 3 rejected
  expect(logs).toContain(`yummy: parse failure ${page(6033)}: parser threw: a group has an unknown status (not 0 to 4)`);

  // The same two tours, without the third: the run passes and saves them.
  answers.set(LISTING_URL, rawListing([rawListingRow(5906), rawListingRow(5662)]));
  const second = await runOperator(
    { ...yummyScraper, minExpectedTours: undefined },
    { db, fetcher, index: places, today: TODAY, now: () => new Date('2026-11-14T00:00:00Z'), log: line => logs.push(line) },
  );
  expect(second).toEqual({ operatorId: 'yummy', ok: true, reasons: [], toursSaved: 2 });
  expect(await db.query("select code, url, days, from_price_hkd, start_kind from tours where operator_id = 'yummy' order by code")).toEqual([
    { code: 'AA-J-TD05', url: page(5906), days: 5, from_price_hkd: 5699, start_kind: 'hk' },
    { code: 'BG-R-ET02', url: page(5662), days: 2, from_price_hkd: 699, start_kind: 'hk' },
  ]);

  const saved = [];
  for (const table of ['tours', 'departures', 'tour_stops', 'price_snapshots', 'unmatched_places', 'scrape_runs']) {
    saved.push(...await db.query(`select row_to_json(t)::text as row from ${table} t`));
  }
  const everything = `${logs.join('\n')}\n${JSON.stringify(saved)}`;
  for (const secret of SECRETS) expect(everything).not.toContain(secret);
  expect(everything).not.toContain(String(SECRET_COUNT));
});
