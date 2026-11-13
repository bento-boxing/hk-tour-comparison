import { it, expect, beforeEach, afterEach } from 'vitest';
import { places, type IsoDate, type OperatorId, type ScrapedTour } from '@hktours/core';
import type { Db } from '@hktours/db';
import { createTestDb } from '@hktours/db/test';
import { runOperator, type RunDeps } from './run-operator';
import type { Fetcher, OperatorScraper } from './types';

const NIGHT_1: IsoDate = '2026-11-12';
const NIGHT_2: IsoDate = '2026-11-13';

let db: Db;
let logLines: string[];
beforeEach(async () => { db = await createTestDb(); logLines = []; });
afterEach(async () => { await db.close(); });

const pageUrl = (code: string) => `https://www.jetour.com.hk/tour/${code}`;

/** A valid jetour tour visiting Osaka and Kyoto with one December departure. */
function tour(code: string, patch: Partial<ScrapedTour> = {}): ScrapedTour {
  return {
    operatorId: 'jetour', code, url: pageUrl(code), title: '大阪京都6天', days: 6, nights: 5,
    dayHeadings: ['香港 → 大阪', '大阪 → 京都'], startPoint: null, endPoint: null, fromPriceHkd: 7999,
    departures: [{ date: '2026-12-18', priceHkd: 7999 }],
    ...patch,
  };
}

/** One fake site: each URL's page is the JSON of a ScrapedTour, the string "null", or unreachable (null). */
type Site = Map<string, string | null>;

function site(entries: [code: string, page: ScrapedTour | 'null' | 'unreachable' | string][]): Site {
  return new Map(entries.map(([code, page]) => [
    pageUrl(code),
    page === 'unreachable' ? null : typeof page === 'string' ? page : JSON.stringify(page),
  ]));
}

function fakeFetcher(pages: Site): Fetcher & { asked: string[] } {
  const asked: string[] = [];
  return { asked, fetchText: async url => { asked.push(url); return pages.get(url) ?? null; } };
}

/** A scraper whose discover lists the site's URLs and whose parse reads the page as JSON. */
function fakeScraper(pages: Site, patch: Partial<OperatorScraper> = {}): OperatorScraper {
  return {
    id: 'jetour',
    discover: async () => [...pages.keys()],
    parse: html => JSON.parse(html) as ScrapedTour | null,
    ...patch,
  };
}

function deps(fetcher: Fetcher, today: IsoDate = NIGHT_1): RunDeps {
  return {
    db, fetcher, index: places, today,
    now: () => new Date(`${today}T18:00:00.000Z`),
    log: line => logLines.push(line),
  };
}

async function run(pages: Site, today: IsoDate = NIGHT_1, patch: Partial<OperatorScraper> = {}) {
  return runOperator(fakeScraper(pages, patch), deps(fakeFetcher(pages), today));
}

const goodTours = (n: number, prefix = 'T') =>
  Array.from({ length: n }, (_, i) => [`${prefix}${i + 1}`, tour(`${prefix}${i + 1}`)] as [string, ScrapedTour]);

interface TourRow { operator_id: OperatorId; code: string; active: boolean; last_seen: string }
const savedTours = () => db.query<TourRow>(
  'select operator_id, code, active, last_seen::text from tours order by operator_id, code');
const activeCodes = async () => (await savedTours()).filter(t => t.active).map(t => t.code).sort();

interface RunRow { ok: boolean; reasons: string[]; pages_fetched: number; parse_failures: number; tours_saved: number; run_date: string }
const scrapeRuns = () => db.query<RunRow>(
  `select ok, reasons, pages_fetched, parse_failures, tours_saved, run_date::text
   from scrape_runs order by id`);

const unmatchedPlaces = () => db.query<{ name: string; example_tour_code: string; seen_count: number }>(
  'select name, example_tour_code, seen_count from unmatched_places order by name');

const logMentions = (...parts: string[]) => logLines.some(line => parts.every(p => line.includes(p)));

// The brief's case is "two valid tours and one null page → ok". Under Task 12's rules one
// failure in three pages (33%) is over MAX_PARSE_FAILURE_RATE, so the ok case uses four valid
// tours and one null page (exactly 20%), and the brief's exact case is pinned separately below.
it('saves good tours and reports ok', async () => {
  const outcome = await run(site([...goodTours(4), ['N', 'null']]));
  expect(outcome).toEqual({ operatorId: 'jetour', ok: true, reasons: [], toursSaved: 4 });
  expect(await activeCodes()).toEqual(['T1', 'T2', 'T3', 'T4']);
  expect(await scrapeRuns()).toEqual([
    { ok: true, reasons: [], pages_fetched: 5, parse_failures: 1, tours_saved: 4, run_date: NIGHT_1 },
  ]);
  expect(logMentions(pageUrl('N'), 'null')).toBe(true);    // one line for the failure, with its URL and reason
  expect(logLines.at(-1)).toBe('jetour: ok, 4 tours saved, 5 tour pages, 1 parse failure, 0 unmatched names'); // final summary line
});

it('two valid tours and one null page is too many parse failures to save', async () => {
  const outcome = await run(site([['A', tour('A')], ['B', tour('B')], ['N', 'null']]));
  expect(outcome).toEqual({ operatorId: 'jetour', ok: false, reasons: ['too-many-parse-failures'], toursSaved: 0 });
  expect(await savedTours()).toEqual([]);
  expect(await scrapeRuns()).toMatchObject([{ ok: false, pages_fetched: 3, parse_failures: 1 }]);
});

it('a page the fetcher cannot get is not a parse failure; 1 in 10 is within the fetch-failure limit', async () => {
  const pages = site([...goodTours(9), ['GONE', 'unreachable']]);
  const outcome = await run(pages);
  expect(outcome).toEqual({ operatorId: 'jetour', ok: true, reasons: [], toursSaved: 9 });
  expect(await scrapeRuns()).toMatchObject([{ ok: true, pages_fetched: 9, parse_failures: 0 }]);
  expect(logMentions(pageUrl('GONE'), 'not fetched')).toBe(true);
});

it('3 pages in 10 that cannot be fetched fail the run: nothing saved, last night\'s data intact', async () => {
  const ten = goodTours(10);
  expect(await run(site(ten), NIGHT_1)).toMatchObject({ ok: true, toursSaved: 10 });

  // Night 2: the same 10 URLs, but 3 of them cannot be fetched (the site pushed back, say).
  const night2 = await run(site(ten.map(([code, page], i) => [code, i < 3 ? 'unreachable' : page])), NIGHT_2);
  expect(night2).toEqual({ operatorId: 'jetour', ok: false, reasons: ['too-many-fetch-failures'], toursSaved: 0 });

  const saved = await savedTours();
  expect(saved).toHaveLength(10);
  expect(saved.every(t => t.active && t.last_seen === NIGHT_1)).toBe(true);
  expect(await scrapeRuns()).toEqual([
    { ok: true, reasons: [], pages_fetched: 10, parse_failures: 0, tours_saved: 10, run_date: NIGHT_1 },
    { ok: false, reasons: ['too-many-fetch-failures'], pages_fetched: 7, parse_failures: 0, tours_saved: 0, run_date: NIGHT_2 },
  ]);
  expect(logLines.at(-1)).toBe(
    'jetour: failed (too-many-fetch-failures), 0 tours saved, 7 tour pages, 0 parse failures, 0 unmatched names');
});

it('a tour with no upcoming departures is skipped, not a failure', async () => {
  const pages = site([['A', tour('A')], ['OLD', tour('OLD', { departures: [{ date: '2026-11-01', priceHkd: 5000 }] })]]);
  const outcome = await run(pages);
  expect(outcome).toMatchObject({ ok: true, toursSaved: 1 });
  expect(await activeCodes()).toEqual(['A']);
  expect(await scrapeRuns()).toMatchObject([{ pages_fetched: 2, parse_failures: 0 }]);
  expect(logLines.at(-1)).toBe('jetour: ok, 1 tour saved, 2 tour pages, 0 parse failures, 0 unmatched names');
});

it('a tour page with no day headings is a parse failure', async () => {
  const pages = site([...goodTours(9), ['BARE', tour('BARE', { dayHeadings: [] })]]);
  const outcome = await run(pages);
  expect(outcome).toEqual({ operatorId: 'jetour', ok: true, reasons: [], toursSaved: 9 }); // 1 in 10 is under the 20% limit
  expect(await activeCodes()).not.toContain('BARE');
  expect(await savedTours()).toHaveLength(9);
  expect(await scrapeRuns()).toMatchObject([{ pages_fetched: 10, parse_failures: 1 }]);
  expect(await unmatchedPlaces()).toEqual([]);
  expect(logMentions(pageUrl('BARE'), 'no-stops')).toBe(true);
  expect(logLines.at(-1)).toBe('jetour: ok, 9 tours saved, 10 tour pages, 1 parse failure, 0 unmatched names');
});

it('a single unmatched name reads in the singular', async () => {
  const pages = site([['A', tour('A', { dayHeadings: ['香港 → 大阪', '大阪 → 亞特蘭提斯'] })]]);
  await run(pages);
  expect(logLines.at(-1)).toBe('jetour: ok, 1 tour saved, 1 tour page, 0 parse failures, 1 unmatched name');
});

it('a tour whose headings match no place is a parse failure and its names are logged', async () => {
  const pages = site([...goodTours(9), ['ATL', tour('ATL', { dayHeadings: ['香港 → 亞特蘭提斯'] })]]);
  const outcome = await run(pages);
  expect(outcome).toMatchObject({ ok: true, toursSaved: 9 });
  expect(await activeCodes()).not.toContain('ATL');
  expect(await scrapeRuns()).toMatchObject([{ pages_fetched: 10, parse_failures: 1 }]);
  expect(await unmatchedPlaces()).toEqual([{ name: '亞特蘭提斯', example_tour_code: 'ATL', seen_count: 1 }]);
  expect(logMentions(pageUrl('ATL'), 'no-stops')).toBe(true);
});

it('a tour with no price at all is a parse failure', async () => {
  const pages = site([...goodTours(9), ['FREE', tour('FREE', { fromPriceHkd: null, departures: [{ date: '2026-12-18', priceHkd: null }] })]]);
  const outcome = await run(pages);
  expect(outcome).toMatchObject({ ok: true, toursSaved: 9 });
  expect(await scrapeRuns()).toMatchObject([{ parse_failures: 1 }]);
  expect(logMentions(pageUrl('FREE'), 'no-price')).toBe(true);
});

it('a page that fails the scraped-tour schema is a parse failure', async () => {
  const pages = site([...goodTours(9), ['BAD', tour('BAD', { days: 0 })]]);
  const outcome = await run(pages);
  expect(outcome).toMatchObject({ ok: true, toursSaved: 9 });
  expect(await activeCodes()).not.toContain('BAD');
  expect(await scrapeRuns()).toMatchObject([{ parse_failures: 1 }]);
  expect(logMentions(pageUrl('BAD'))).toBe(true);
});

it('rejects a tour claiming another operator id', async () => {
  const pages = site([...goodTours(9), ['EGL1', tour('EGL1', { operatorId: 'egl' })]]);
  const outcome = await run(pages);
  expect(outcome).toMatchObject({ operatorId: 'jetour', ok: true, toursSaved: 9 });
  const saved = await savedTours();
  expect(saved.map(t => t.code)).not.toContain('EGL1');
  expect(saved.every(t => t.operator_id === 'jetour')).toBe(true);
  expect(await scrapeRuns()).toMatchObject([{ parse_failures: 1 }]);
  expect(logMentions(pageUrl('EGL1'), 'egl')).toBe(true);
});

it('keeps the first of two tours with the same code', async () => {
  const pages: Site = new Map([
    [pageUrl('A'), JSON.stringify(tour('A', { title: 'first' }))],
    [`${pageUrl('A')}?again`, JSON.stringify(tour('A', { title: 'second' }))],
    [pageUrl('B'), JSON.stringify(tour('B'))],
  ]);
  const outcome = await run(pages);
  expect(outcome).toMatchObject({ ok: true, toursSaved: 2 });
  expect(await db.query('select code, title from tours order by code'))
    .toEqual([{ code: 'A', title: 'first' }, { code: 'B', title: '大阪京都6天' }]);
  expect(await scrapeRuns()).toMatchObject([{ pages_fetched: 3, parse_failures: 0, tours_saved: 2 }]);
});

it('fetches each discovered URL once', async () => {
  const pages = site([['A', tour('A')], ['B', tour('B')]]);
  const fetcher = fakeFetcher(pages);
  const scraper = fakeScraper(pages, { discover: async () => [pageUrl('A'), pageUrl('B'), pageUrl('A')] });
  await runOperator(scraper, deps(fetcher));
  expect(fetcher.asked).toEqual([pageUrl('A'), pageUrl('B')]);
});

it('saves each unmatched name once per run, with the last tour code seen', async () => {
  const withAtlantis = (code: string) => tour(code, { dayHeadings: ['香港 → 大阪', '大阪 → 亞特蘭提斯'] });
  const pages = site([['A', withAtlantis('A')], ['B', withAtlantis('B')], ['C', tour('C')]]);
  const outcome = await run(pages);
  expect(outcome).toMatchObject({ ok: true, toursSaved: 3 });
  expect(await unmatchedPlaces()).toEqual([{ name: '亞特蘭提斯', example_tour_code: 'B', seen_count: 1 }]);
});

it('a bad run keeps last night\'s data', async () => {
  const thirty = goodTours(30);
  const night1 = await run(site(thirty), NIGHT_1);
  expect(night1).toMatchObject({ ok: true, toursSaved: 30 });

  // Night 2: the same 30 URLs, but 25 pages now parse to null.
  const night2Pages = site(thirty.map(([code, page], i) => [code, i < 25 ? 'null' : page]));
  const night2 = await run(night2Pages, NIGHT_2);
  expect(night2.ok).toBe(false);
  expect(night2.toursSaved).toBe(0);
  expect(night2.reasons).toEqual(expect.arrayContaining(['tour-count-dropped', 'too-many-parse-failures']));

  const saved = await savedTours();
  expect(saved).toHaveLength(30);
  expect(saved.every(t => t.active && t.last_seen === NIGHT_1)).toBe(true);
  expect(await scrapeRuns()).toEqual([
    { ok: true, reasons: [], pages_fetched: 30, parse_failures: 0, tours_saved: 30, run_date: NIGHT_1 },
    { ok: false, reasons: ['tour-count-dropped', 'too-many-parse-failures'], pages_fetched: 30, parse_failures: 25, tours_saved: 0, run_date: NIGHT_2 },
  ]);
});

it('a first run with fewer tours than the scraper\'s floor is a failed run and saves nothing', async () => {
  const outcome = await run(site(goodTours(5)), NIGHT_1, { minExpectedTours: 6 });
  expect(outcome).toEqual({ operatorId: 'jetour', ok: false, reasons: ['below-minimum'], toursSaved: 0 });
  expect(await savedTours()).toEqual([]);
  expect(await scrapeRuns()).toEqual([
    { ok: false, reasons: ['below-minimum'], pages_fetched: 5, parse_failures: 0, tours_saved: 0, run_date: NIGHT_1 },
  ]);
});

it('a first run at the scraper\'s floor is saved', async () => {
  expect(await run(site(goodTours(5)), NIGHT_1, { minExpectedTours: 5 })).toMatchObject({ ok: true, toursSaved: 5 });
});

it('the floor is ignored once there is a previous good run', async () => {
  expect(await run(site(goodTours(30)), NIGHT_1)).toMatchObject({ ok: true, toursSaved: 30 });
  expect(await run(site(goodTours(25)), NIGHT_2, { minExpectedTours: 150 })).toMatchObject({ ok: true, toursSaved: 25 });
});

it('zero discovered URLs is a failed run', async () => {
  const outcome = await run(new Map());
  expect(outcome).toEqual({ operatorId: 'jetour', ok: false, reasons: ['no-tours'], toursSaved: 0 });
  expect(await scrapeRuns()).toMatchObject([{ ok: false, reasons: ['no-tours'], pages_fetched: 0 }]);
});

it('a throwing parser is a parse failure, not a crash', async () => {
  const pages = site([...goodTours(9), ['BOOM', '{"boom":true}']]);
  const outcome = await run(pages, NIGHT_1, {
    parse: html => {
      const value = JSON.parse(html) as ScrapedTour & { boom?: boolean };
      if (value.boom) throw new Error('selector not found');
      return value;
    },
  });
  expect(outcome).toMatchObject({ ok: true, toursSaved: 9 });
  expect(await scrapeRuns()).toMatchObject([{ pages_fetched: 10, parse_failures: 1 }]);
  expect(logMentions(pageUrl('BOOM'), 'selector not found')).toBe(true);
});

it('a throwing discover ends the run as failed', async () => {
  const pages = site(goodTours(3));
  const fetcher = fakeFetcher(pages);
  const scraper = fakeScraper(pages, { discover: async () => { throw new Error('sitemap moved'); } });
  const outcome = await runOperator(scraper, deps(fetcher));
  expect(outcome).toEqual({ operatorId: 'jetour', ok: false, reasons: ['discover-error'], toursSaved: 0 });
  expect(fetcher.asked).toEqual([]);
  expect(await savedTours()).toEqual([]);
  expect(await scrapeRuns()).toEqual([
    { ok: false, reasons: ['discover-error'], pages_fetched: 0, parse_failures: 0, tours_saved: 0, run_date: NIGHT_1 },
  ]);
  expect(logMentions('sitemap moved')).toBe(true);
});
