import { afterEach, beforeEach, expect, it } from 'vitest';
import { places } from '@hktours/core';
import type { Db } from '@hktours/db';
import { createTestDb } from '@hktours/db/test';
import { runOperator } from '../../run-operator';
import type { Fetcher } from '../../types';
import { bookingUrl, LISTING_URL } from './discover';
import { createSunflowerScraper, sunflowerScraper } from './index';
import { rawBookingPage, rawListing, rawListingRow, SECRETS } from './test-responses';

const TODAY = '2026-11-14';

it('is registered as sunflower, with a provisional first-run floor and no extra request headers', () => {
  expect(sunflowerScraper.id).toBe('sunflower');
  expect(sunflowerScraper.requestHeaders).toBeUndefined();
  expect(sunflowerScraper.fetchPage).toBeDefined();
  expect(sunflowerScraper.minExpectedTours).toBe(222); // 60% of the 370 bookable tours, until a measured crawl
});

it('throws its reason for a page it rejects, so the run\'s log says why', () => {
  expect(() => sunflowerScraper.parse('<html></html>', bookingUrl('KKFE05WR'))).toThrow('not the joined listing entry and booking page');
});

let db: Db;
beforeEach(async () => { db = await createTestDb(); });
afterEach(async () => { await db.close(); });

it('a run requests only the listing, then each tour\'s booking page, by GET, and keeps no marketing text', async () => {
  const answers = new Map<string, string>([
    [LISTING_URL, JSON.stringify(rawListing([
      rawListingRow('KKFE05WR'),
      rawListingRow('', { region: '郵輪' }),
      // The listing's "from" price (10,899) is below the shown month's (11,399): the later dates are shown at 10,899.
      rawListingRow('BTTK09SP', {
        Title: '土耳其9天', region: '長線', area: '地中海、中東', subarea: '土耳其',
        minprice: 15499, discount: 10899, discounttext: '10,899', tdp_confirm: '', tdp_hardpush: '5/12,13/1...',
      }),
      rawListingRow('CFAG03MK', { Title: '【3天金秋韶關賞銀杏紅葉純玩美食團】 旺角集散', region: '中國短線', area: '廣東省', subarea: '廣州、中山、深圳' }),
    ]))],
    [bookingUrl('KKFE05WR'), rawBookingPage()],
    [bookingUrl('BTTK09SP'), rawBookingPage({ code: 'BTTK09SP', days: '#9天團', month: '2026年11月', cells: [{ date: '20261127', price: '$11,399起' }] })],
    [bookingUrl('CFAG03MK'), rawBookingPage({ code: 'CFAG03MK', days: null })], // no days tag: a parse failure
  ]);
  const asked: string[] = [];
  const fetcher: Fetcher = {
    fetchText: async url => {
      asked.push(url);
      return answers.get(url) ?? null;
    },
    postJson: async url => { throw new Error(`POSTed ${url}`); },
  };
  const logs: string[] = [];
  const run = () => runOperator(
    { ...createSunflowerScraper({ log: line => logs.push(line) }), minExpectedTours: undefined },
    { db, fetcher, index: places, today: TODAY, now: () => new Date('2026-11-14T00:00:00Z'), log: line => logs.push(line) },
  );

  const outcome = await run();
  // Only the two allowed paths: never a ?date= booking step, a PDF, a postback or CheckUpdate.ashx.
  expect(asked).toEqual([LISTING_URL, bookingUrl('KKFE05WR'), bookingUrl('BTTK09SP'), bookingUrl('CFAG03MK')]);
  const allowed = /^https:\/\/www\.sunflower\.com\.hk\/(?:App\/Tour\/Get\?Region=&Area=&Subarea=&keyword=|OnlineBooking\/\?TourCode=[A-Z0-9]+)$/;
  for (const url of asked) expect(url).toMatch(allowed);
  expect(outcome).toMatchObject({ operatorId: 'sunflower', ok: false, reasons: ['too-many-parse-failures'] }); // 1 of 3
  expect(logs).toContain('sunflower: left out 1 listing entry without an online booking code (郵輪 1)');
  expect(logs).toContain(`sunflower: parse failure ${bookingUrl('CFAG03MK')}: parser threw: the booking page has no day count (#Content_lbtnday)`);

  answers.set(bookingUrl('CFAG03MK'), rawBookingPage({ code: 'CFAG03MK', days: '#3天團', month: '2026年11月', cells: [{ date: '20261122', price: '$1,249起' }] }));
  asked.length = 0;
  const second = await run();
  expect(second).toEqual({ operatorId: 'sunflower', ok: true, reasons: [], toursSaved: 3 });
  expect(await db.query(
    "select code, url, days, from_price_hkd, start_kind from tours where operator_id = 'sunflower' order by code",
  )).toEqual([
    { code: 'BTTK09SP', url: bookingUrl('BTTK09SP'), days: 9, from_price_hkd: 10899, start_kind: 'hk' },
    { code: 'CFAG03MK', url: bookingUrl('CFAG03MK'), days: 3, from_price_hkd: 1249, start_kind: 'hk' },
    { code: 'KKFE05WR', url: bookingUrl('KKFE05WR'), days: 5, from_price_hkd: 2699, start_kind: 'hk' },
  ]);
  expect(await db.query(
    `select d.date::text as date, d.price_hkd from departures d join tours t on t.id = d.tour_id
     where t.code = 'BTTK09SP' order by d.date`,
  )).toEqual([
    { date: '2026-11-27', price_hkd: 11399 }, { date: '2026-12-05', price_hkd: null }, { date: '2027-01-13', price_hkd: null },
  ]);

  const saved = [];
  for (const table of ['tours', 'departures', 'tour_stops', 'price_snapshots', 'unmatched_places', 'scrape_runs']) {
    saved.push(...await db.query(`select row_to_json(t)::text as row from ${table} t`));
  }
  const everything = `${logs.join('\n')}\n${JSON.stringify(saved)}`;
  for (const secret of SECRETS) expect(everything).not.toContain(secret);
});
