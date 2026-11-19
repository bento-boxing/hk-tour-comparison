import { afterEach, beforeEach, expect, it } from 'vitest';
import { places } from '@hktours/core';
import type { Db } from '@hktours/db';
import { createTestDb } from '@hktours/db/test';
import { DRY_RUN_LOG } from '../../public-log';
import { runOperator } from '../../run-operator';
import type { Fetcher } from '../../types';
import { eventUrl, listUrl, tourPageUrl } from './discover';
import { createTasteScraper, tasteScraper } from './index';
import { rawDate, rawDates, rawListPage, rawTourPage, SECRETS } from './test-responses';

const TODAY = '2026-11-20';

it('is registered as taste, with a provisional first-run floor and no extra request headers', () => {
  expect(tasteScraper.id).toBe('taste');
  expect(tasteScraper.requestHeaders).toBeUndefined();
  expect(tasteScraper.fetchPage).toBeDefined();
  // Provisional (no measured crawl yet): 60% of the 311 products the list held on 2026-11-20, every one a group tour.
  expect(tasteScraper.minExpectedTours).toBe(186);
});

it('throws its reason for a page it rejects, so the run\'s log says why', () => {
  expect(() => tasteScraper.parse('<html></html>', tourPageUrl('693'))).toThrow('not the joined tour page and dates answer');
});

let db: Db;
beforeEach(async () => { db = await createTestDb(); });
afterEach(async () => { await db.close(); });

/** The only three path shapes the scraper may request, on https://tastetravel.com.hk. */
const ALLOWED = /^https:\/\/tastetravel\.com\.hk\/tour\/(?:select\/page\/(?:0|[1-9]\d*0)|detail\/tour_id\/[1-9]\d*|event\/tour_id\/[1-9]\d*)$/;

it('a run requests only the list pages, then each tour\'s page and dates answer, by GET, and keeps no marketing text', async () => {
  const answers = new Map<string, string>([
    [listUrl(0), rawListPage({
      next: true, total: 5,
      cards: [
        { href: 693, title: 'CAK03 - 江門三天', days: '3天' },
        { href: 586, title: 'EED09 - 埃及九天', days: '9天' },
        { href: 900, title: '郵輪套票 SECRET-DESCRIPTION', days: '5天' }, // no code: not a group tour, not fetched
      ],
    })],
    [listUrl(10), rawListPage({ offset: 10, total: 5, cards: [{ href: 1175, title: 'GAF04 - 福建四天', days: '4天' }, { href: 1170, title: 'LHA02 - ', days: '2天' }] })],
    [tourPageUrl('693'), rawTourPage()],
    [eventUrl('693'), rawDates([rawDate('2026-11-19', '已成團'), rawDate('2026-11-21', '已成團'), rawDate('2026-12-24', '快成團'), rawDate('2026-12-25', '額滿')])],
    [tourPageUrl('586'), rawTourPage({
      title: '埃及九天', number: '團號：EED09', days: '行程天數：9天', price: '21998',
      dayLines: ['香港 ⇨ 杜拜 ⇨ 開羅', '開羅⇨ 阿斯旺', '阿斯旺 ⇨ 艾德夫', '艾德夫 ⇨ 樂蜀', '樂蜀', '樂蜀', '開羅', '開羅 ⇨ 杜拜', '杜拜⇨ 香港'],
      notice: '行程編號: EED09-010925<br />集合時間地點 : 香港國際機場 <br />***SECRET-NOTES***',
    })],
    [eventUrl('586'), rawDates([rawDate('2026-12-10', '收客中')])],
    [tourPageUrl('1175'), rawTourPage({ number: null })], // no code: a parse failure
    [eventUrl('1175'), rawDates()],
    [tourPageUrl('1170'), rawTourPage({ number: '團號：LHA02' })],
    [eventUrl('1170'), rawDates([rawDate('2026-11-01')])], // no date left: skipped as no-departures
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
    { ...createTasteScraper({ log: line => logs.push(line) }), minExpectedTours: undefined },
    { db, fetcher, index: places, today: TODAY, now: () => new Date('2026-11-20T00:00:00Z'), log: line => logs.push(line) },
  );

  const outcome = await run();
  expect(asked).toEqual([
    listUrl(0), listUrl(10),
    tourPageUrl('693'), eventUrl('693'), tourPageUrl('586'), eventUrl('586'),
    tourPageUrl('1175'), eventUrl('1175'), tourPageUrl('1170'), eventUrl('1170'),
  ]);
  for (const url of asked) expect(url).toMatch(ALLOWED);
  expect(outcome).toMatchObject({ operatorId: 'taste', ok: false, reasons: ['too-many-parse-failures'] }); // 1 of 4
  // A real run's log (PUBLIC_LOG): counts, fixed texts, tour codes, dates and references only.
  expect(logs).toContain('taste: left out 1 list entry that is not a group tour (no tour code 1)');
  expect(logs).toContain(`taste: parse failure ${tourPageUrl('1175')}: parser threw: the tour page has no tour code (.detail-number)`);
  expect(logs).toContain('taste: skipped LHA02: no-departures');
  expect(logs.some(line => /^taste: CAK03: date 2026-12-25 has the status \* \(ref [0-9a-f]{8}\), skipped$/.test(line))).toBe(true);
  expect(logs.join('\n')).not.toContain('額滿');

  answers.set(tourPageUrl('1175'), rawTourPage({ number: '團號：GAF04', days: '行程天數：4天', price: '1999', dayLines: ['香港西九龍 → 漳州', '南靖', '漳州', '漳州 → 香港'] }));
  asked.length = 0;
  const second = await run();
  expect(second).toEqual({ operatorId: 'taste', ok: true, reasons: [], toursSaved: 3 });
  expect(await db.query(
    "select code, url, days, from_price_hkd, start_kind from tours where operator_id = 'taste' order by code",
  )).toEqual([
    { code: 'CAK03', url: tourPageUrl('693'), days: 3, from_price_hkd: 699, start_kind: 'sz' },
    { code: 'EED09', url: tourPageUrl('586'), days: 9, from_price_hkd: 21998, start_kind: 'hk' },
    { code: 'GAF04', url: tourPageUrl('1175'), days: 4, from_price_hkd: 1999, start_kind: 'sz' },
  ]);
  // Every date after the run's date, none with a price of its own: shown at the tour's "from" price, marked 起.
  expect(await db.query(
    `select t.code, d.date::text as date, d.price_hkd from departures d join tours t on t.id = d.tour_id
     where t.operator_id = 'taste' order by t.code, d.date`,
  )).toEqual([
    { code: 'CAK03', date: '2026-11-21', price_hkd: null }, { code: 'CAK03', date: '2026-12-24', price_hkd: null },
    { code: 'EED09', date: '2026-12-10', price_hkd: null },
    { code: 'GAF04', date: '2026-11-27', price_hkd: null },
  ]);

  const saved = [];
  for (const table of ['tours', 'departures', 'tour_stops', 'price_snapshots', 'unmatched_places', 'scrape_runs']) {
    saved.push(...await db.query(`select row_to_json(t)::text as row from ${table} t`));
  }
  const everything = `${logs.join('\n')}\n${JSON.stringify(saved)}`;
  for (const secret of SECRETS) expect(everything).not.toContain(secret);
});

it('a dry run\'s log (DRY_RUN_LOG) shows an unknown status whole, with the same reference', async () => {
  const answers = new Map<string, string>([
    [listUrl(0), rawListPage({ total: 1, cards: [{ href: 693, title: 'CAK03 - ', days: '3天' }] })],
    [tourPageUrl('693'), rawTourPage()],
    [eventUrl('693'), rawDates([rawDate('2026-12-01', '額滿'), rawDate('2026-12-02')])],
  ]);
  const fetcher: Fetcher = { fetchText: async url => answers.get(url) ?? null };
  const logs: string[] = [];
  await runOperator(
    { ...createTasteScraper({ log: line => logs.push(line) }), minExpectedTours: undefined },
    { db, fetcher, index: places, today: TODAY, now: () => new Date('2026-11-20T00:00:00Z'), log: line => logs.push(line), logView: DRY_RUN_LOG },
  );
  expect(logs.some(line => /^taste: CAK03: date 2026-12-01 has the status 額滿 \(ref [0-9a-f]{8}\), skipped$/.test(line))).toBe(true);
});
