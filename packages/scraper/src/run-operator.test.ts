import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { places, type IsoDate, type OperatorId, type ScrapedTour } from '@hktours/core';
import type { Db } from '@hktours/db';
import { createTestDb } from '@hktours/db/test';
import { jetourScraper } from './operators/jetour';
import { createFetcher } from './polite-fetch';
import { DRY_RUN_LOG, logRef, PUBLIC_LOG } from './public-log';
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
    allowedHosts: ['www.jetour.com.hk'],
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

describe('a page whose redirect leaves the allowed hosts (task 66), through the real fetcher', () => {
  // fetch is replaced (no network): robots.txt allows everything, a page in `away` redirects to another host, and
  // every other page answers its tour's JSON.
  let requested: string[];
  function realFetcher(pages: Site, away: Set<string>): Fetcher {
    requested = [];
    vi.stubGlobal('fetch', async (input: URL | string) => {
      const href = String(input);
      requested.push(href);
      if (href.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow:', { status: 200 });
      if (away.has(href)) return new Response(null, { status: 302, headers: { location: 'https://elsewhere.test/x?y=1' } });
      const page = pages.get(href);
      return page == null ? new Response(null, { status: 404 }) : new Response(page, { status: 200 });
    });
    return createFetcher({ userAgent: 'test-bot/0.1', delayMs: 0, log: line => logLines.push(line), allowedHosts: ['www.jetour.com.hk'] });
  }
  afterEach(() => { vi.unstubAllGlobals(); });

  it('is a page not fetched: logged by host, the run goes on, and nothing is requested of the other host', async () => {
    const pages = site(goodTours(10));
    const outcome = await runOperator(fakeScraper(pages), deps(realFetcher(pages, new Set([pageUrl('T1')]))));
    expect(outcome).toEqual({ operatorId: 'jetour', ok: true, reasons: [], toursSaved: 9 });
    expect(requested.some(href => href.includes('elsewhere.test'))).toBe(false);
    expect(logLines).toContain(
      `not fetched ${pageUrl('T1')}: a redirect to elsewhere.test, not one of the allowed hosts, is not followed`);
    expect(logLines).toContain(`jetour: skipped ${pageUrl('T1')}: not fetched`);
    expect(logLines.some(line => line.includes('y=1'))).toBe(false);
  });

  it('a child sitemap off the hosts is skipped on the run\'s own log (the runner hands discover its log)', async () => {
    const index = '<sitemapindex><sitemap><loc>https://elsewhere.test/child.xml?y=1</loc></sitemap></sitemapindex>';
    const fetcher: Fetcher = { fetchText: async url => (url === 'https://www.jetour.com.hk/sitemap.xml' ? index : null) };
    const outcome = await runOperator(jetourScraper, deps(fetcher));
    expect(outcome).toMatchObject({ ok: false, toursSaved: 0 });
    expect(outcome.reasons).toContain('no-tours');
    expect(logLines).toContain('sitemap: skipped 1 child sitemap not on the operator\'s hosts (elsewhere.test)');
  });

  it('counts toward the fetch-failure limit like any page not fetched: 3 in 10 save nothing, last night\'s tours stay', async () => {
    const pages = site(goodTours(10));
    expect(await runOperator(fakeScraper(pages), deps(realFetcher(pages, new Set()), NIGHT_1))).toMatchObject({ ok: true, toursSaved: 10 });
    const away = new Set(['T1', 'T2', 'T3'].map(pageUrl));
    const night2 = await runOperator(fakeScraper(pages), deps(realFetcher(pages, away), NIGHT_2));
    expect(night2).toEqual({ operatorId: 'jetour', ok: false, reasons: ['too-many-fetch-failures'], toursSaved: 0 });
    expect(await activeCodes()).toHaveLength(10);
  });
});

describe('a scraper that fetches each page itself (fetchPage)', () => {
  /** fetchPage asks the fetcher for the page and for `<url>/extra`, and gives parse the page only when both came back. */
  const twoRequests: Partial<OperatorScraper> = {
    fetchPage: async (fetcher, url) => {
      const page = await fetcher.fetchText(url);
      if (page === null) return null;
      return (await fetcher.fetchText(`${url}/extra`)) === null ? null : page;
    },
  };
  const withExtras = (pages: Site, missing: string[] = []) =>
    new Map([...pages, ...[...pages.keys()].filter(url => !missing.includes(url)).map(url => [`${url}/extra`, 'x'] as [string, string])]);

  it('makes every request through the run\'s fetcher, and parses what fetchPage returns', async () => {
    const pages = site(goodTours(2));
    const fetcher = fakeFetcher(withExtras(pages));
    const outcome = await runOperator(fakeScraper(pages, twoRequests), deps(fetcher));
    expect(outcome).toEqual({ operatorId: 'jetour', ok: true, reasons: [], toursSaved: 2 });
    expect(fetcher.asked).toEqual([pageUrl('T1'), `${pageUrl('T1')}/extra`, pageUrl('T2'), `${pageUrl('T2')}/extra`]);
  });

  it('a page whose second request fails is a page not fetched, counted toward the fetch-failure limit', async () => {
    const pages = site(goodTours(10));
    const missing = [pageUrl('T1'), pageUrl('T2'), pageUrl('T3')];
    const outcome = await runOperator(fakeScraper(pages, twoRequests), deps(fakeFetcher(withExtras(pages, missing))));
    expect(outcome).toEqual({ operatorId: 'jetour', ok: false, reasons: ['too-many-fetch-failures'], toursSaved: 0 });
    expect(await scrapeRuns()).toMatchObject([{ ok: false, pages_fetched: 7, parse_failures: 0 }]);
    expect(logMentions(pageUrl('T1'), 'not fetched')).toBe(true);
  });

  it('a fetchPage that throws counts as a page not fetched, not a crash', async () => {
    const pages = site(goodTours(10));
    const throwing: Partial<OperatorScraper> = {
      fetchPage: async (fetcher, url) => {
        if (url === pageUrl('T1')) throw new Error('boom');
        return fetcher.fetchText(url);
      },
    };
    const outcome = await runOperator(fakeScraper(pages, throwing), deps(fakeFetcher(pages)));
    expect(outcome).toEqual({ operatorId: 'jetour', ok: true, reasons: [], toursSaved: 9 });
    expect(logMentions(pageUrl('T1'), 'not fetched (fetch threw: boom)')).toBe(true);
  });

  it('is given the run\'s today (Hong Kong), not the wall clock', async () => {
    const pages = site(goodTours(1));
    const days: string[] = [];
    const recording: Partial<OperatorScraper> = {
      fetchPage: async (fetcher, url, today) => { days.push(today); return fetcher.fetchText(url); },
    };
    await runOperator(fakeScraper(pages, recording), deps(fakeFetcher(pages), NIGHT_2));
    expect(days).toEqual([NIGHT_2]);
  });

  it('a page fetchPage reports gone is skipped: neither fetched nor a fetch failure', async () => {
    const pages = site(goodTours(4));
    const gone: Partial<OperatorScraper> = {
      fetchPage: async (fetcher, url) => (url === pageUrl('T1') ? { skip: 'gone' } : fetcher.fetchText(url)),
    };
    const outcome = await runOperator(fakeScraper(pages, gone), deps(fakeFetcher(pages)));
    expect(outcome).toEqual({ operatorId: 'jetour', ok: true, reasons: [], toursSaved: 3 });
    expect(await scrapeRuns()).toMatchObject([{ ok: true, pages_fetched: 3, parse_failures: 0 }]);
    expect(logLines).toContain(`jetour: skipped ${pageUrl('T1')}: gone`);
    expect(logMentions(pageUrl('T1'), 'not fetched')).toBe(false);
  });

  it('gone pages do not count toward the fetch-failure limit', async () => {
    const pages = site(goodTours(10));
    const goneUrls = [pageUrl('T1'), pageUrl('T2'), pageUrl('T3')];
    const gone: Partial<OperatorScraper> = {
      fetchPage: async (fetcher, url) => (goneUrls.includes(url) ? { skip: 'gone' } : fetcher.fetchText(url)),
    };
    const outcome = await runOperator(fakeScraper(pages, gone), deps(fakeFetcher(pages)));
    expect(outcome).toMatchObject({ ok: true, toursSaved: 7 });
  });

  it('gone pages are left out of the pages the fetch-failure rate is taken over', async () => {
    // 2 not fetched of 10 discovered is 20% (allowed); of the 5 that are not gone it is 40% (too many).
    const pages = site(goodTours(10));
    const goneUrls = ['T1', 'T2', 'T3', 'T4', 'T5'].map(pageUrl);
    const unreachable = ['T6', 'T7'].map(pageUrl);
    const gone: Partial<OperatorScraper> = {
      fetchPage: async (fetcher, url) =>
        (goneUrls.includes(url) ? { skip: 'gone' } : unreachable.includes(url) ? null : fetcher.fetchText(url)),
    };
    const outcome = await runOperator(fakeScraper(pages, gone), deps(fakeFetcher(pages)));
    expect(outcome).toMatchObject({ ok: false, reasons: ['too-many-fetch-failures'] });
  });
});

it('a fetcher that throws, against its contract, counts as a page not fetched for a scraper without fetchPage', async () => {
  const pages = site(goodTours(10));
  const inner = fakeFetcher(pages);
  const fetcher: Fetcher = {
    fetchText: async url => {
      if (url === pageUrl('T1')) throw new Error('socket closed');
      return inner.fetchText(url);
    },
  };
  const outcome = await runOperator(fakeScraper(pages), deps(fetcher));
  expect(outcome).toEqual({ operatorId: 'jetour', ok: true, reasons: [], toursSaved: 9 });
  expect(logMentions(pageUrl('T1'), 'not fetched (fetch threw: socket closed)')).toBe(true);
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
  expect(logLines).toContain('jetour: parse failure BARE: no-stops');
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
  expect(logLines).toContain('jetour: parse failure ATL: no-stops (1 unmatched word)');
});

it('a tour with no price at all is a parse failure', async () => {
  const pages = site([...goodTours(9), ['FREE', tour('FREE', { fromPriceHkd: null, departures: [{ date: '2026-12-18', priceHkd: null }] })]]);
  const outcome = await run(pages);
  expect(outcome).toMatchObject({ ok: true, toursSaved: 9 });
  expect(await scrapeRuns()).toMatchObject([{ parse_failures: 1 }]);
  expect(logLines).toContain('jetour: parse failure FREE: no-price');
});

it('a page that fails the scraped-tour schema is a parse failure', async () => {
  const pages = site([...goodTours(9), ['BAD', tour('BAD', { days: 0 })]]);
  const outcome = await run(pages);
  expect(outcome).toMatchObject({ ok: true, toursSaved: 9 });
  expect(await activeCodes()).not.toContain('BAD');
  expect(await scrapeRuns()).toMatchObject([{ parse_failures: 1 }]);
  expect(logMentions('jetour: parse failure BAD: invalid scraped tour (days:')).toBe(true);
});

it('rejects a tour claiming another operator id', async () => {
  const pages = site([...goodTours(9), ['EGL1', tour('EGL1', { operatorId: 'egl' })]]);
  const outcome = await run(pages);
  expect(outcome).toMatchObject({ operatorId: 'jetour', ok: true, toursSaved: 9 });
  const saved = await savedTours();
  expect(saved.map(t => t.code)).not.toContain('EGL1');
  expect(saved.every(t => t.operator_id === 'jetour')).toBe(true);
  expect(await scrapeRuns()).toMatchObject([{ parse_failures: 1 }]);
  expect(logLines).toContain('jetour: parse failure EGL1: operator id egl, expected jetour');
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

describe('the public run log (task 35 fix round 2)', () => {
  it('lists the places the day-line rules dropped, by tour code and place name, one line per tour', async () => {
    await run(site([
      ['A', tour('A', { days: 3, dayHeadings: ['香港 → 中山', '高山賞紅葉 → 東方威尼斯水鄉', '珠海 → 香港'] })],
      ['B', tour('B')],
    ]));
    expect(logLines.filter(line => line.includes('day-line drops'))).toEqual([
      'jetour: day-line drops A: 威尼斯 (comparison), 高山 (too-far)',
    ]);
    expect(logLines.at(-1)).toMatch(/^jetour: ok, 2 tours saved/); // the summary stays last
  });
  it('lists them for a tour that is not saved too', async () => {
    await run(site([...goodTours(9), ['V', tour('V', { dayHeadings: ['香港 → 東方威尼斯水鄉'] })]]));
    expect(logLines).toContain('jetour: day-line drops V: 威尼斯 (comparison)');
  });
  it('prints no day-heading text for a no-stops tour whose headings name no place: only how many headings there were', async () => {
    const headings = ['測試用的第一段很長的文字內容', '測試用的第二段很長的文字內容'];
    await run(site([...goodTours(9), ['P', tour('P', { dayHeadings: headings })]]));
    const failure = logLines.filter(line => line.startsWith('jetour: parse failure '));
    expect(failure).toEqual(['jetour: parse failure P: no-stops (2 day headings, no place named)']);
    for (const line of logLines) for (const heading of headings) expect(line).not.toContain(heading.slice(0, 6));
    // what is stored for review is unchanged: the headings, cut to 40 characters
    expect((await unmatchedPlaces()).map(row => row.name).sort()).toEqual([...headings].sort());
  });
  it('prints how many unmatched words a no-stops tour has, not the words (they are the operator\'s phrases)', async () => {
    const words = ['亞特蘭提斯', '夢幻樂園', '星光步道'];
    await run(site([...goodTours(9), ['ATL', tour('ATL', { dayHeadings: [`香港 → ${words[0]}`, words[1], words[2]] })]]));
    expect(logLines).toContain('jetour: parse failure ATL: no-stops (3 unmatched words)');
    for (const line of logLines) for (const word of words) expect(line).not.toContain(word);
    // what is stored for review is unchanged: the words themselves
    expect((await unmatchedPlaces()).map(row => row.name).sort()).toEqual([...words].sort());
  });
  it('says "word" for one', async () => {
    await run(site([...goodTours(9), ['ONE', tour('ONE', { dayHeadings: ['香港 → 亞特蘭提斯'] })]]));
    expect(logLines).toContain('jetour: parse failure ONE: no-stops (1 unmatched word)');
  });
});

describe('the routes read from fallback text that are new or changed (so the owner reads only those)', () => {
  /** A tour whose day headings name no place, its stops read from the fallback text. */
  const titled = (code: string, fallbackRoute: string) =>
    tour(code, { days: 2, dayHeadings: ['香港 → 溫泉', '酒店 → 香港'], fallbackRoute });
  const routeLines = () => logLines.filter(line => line.includes('title route'));

  it('lists each one new tonight, and no route read from day headings', async () => {
    await run(site([['A', titled('A', '中山 珠海2天')], ['B', titled('B', '江門2天')], ['C', tour('C')]]));
    expect(routeLines()).toEqual([
      'jetour: new title route A: 中山 → 珠海',
      'jetour: new title route B: 江門',
    ]);
    expect(logLines.at(-1)).toMatch(/^jetour: ok, 3 tours saved/); // the summary stays last
  });
  it('lists one whose stops differ from last night\'s, with them, and none whose stops are the same', async () => {
    await run(site([['A', titled('A', '中山2天')], ['B', titled('B', '江門2天')], ['C', tour('C')]]));
    logLines = [];
    await run(site([['A', titled('A', '珠海2天')], ['B', titled('B', '江門 溫泉2天')], ['C', titled('C', '佛山2天')]]), NIGHT_2);
    expect(routeLines()).toEqual([
      'jetour: changed title route A: 珠海 (was 中山)',
      'jetour: changed title route C: 佛山 (was 大阪 → 京都)',
    ]);
  });
  it('does not list a tour whose route now comes from its day headings', async () => {
    await run(site([['A', titled('A', '中山2天')]]));
    logLines = [];
    await run(site([['A', tour('A', { fallbackRoute: '中山2天' })]]), NIGHT_2);
    expect(routeLines()).toEqual([]);
  });
  it('lists nothing for a run that saves nothing', async () => {
    await run(site([['A', titled('A', '中山2天')], ['N1', 'null'], ['N2', 'null']]));
    expect(await savedTours()).toEqual([]);
    expect(routeLines()).toEqual([]);
  });
});

describe('the public run log names a page by its tour code, never by an address that carries a title (task 36)', () => {
  /** An address like Charming's older ones: an invented title, percent-encoded. */
  const titled = (code: string) => `https://www.example.com/?tour=${encodeURIComponent(`5天測試之旅-${code}`).toLowerCase()}`;
  const titledSite = (entries: [code: string, page: ScrapedTour | 'null' | 'unreachable' | string][]): Site =>
    new Map(entries.map(([code, page]) => [
      titled(code),
      page === 'unreachable' ? null : typeof page === 'string' ? page : JSON.stringify(page),
    ]));
  const noTitleText = () => {
    for (const line of logLines) {
      expect(line).not.toContain('%');
      expect(line).not.toContain('測試');
    }
  };

  it('once the code is known: no-departures, duplicate, parse failure and day-line drops lines name the code only', async () => {
    const pages: Site = new Map([
      ...titledSite([...goodTours(9), ['OLD', tour('OLD', { departures: [{ date: '2026-11-01', priceHkd: 5000 }] })]]),
      ...titledSite([['DUP', tour('T1')], ['ATL', tour('ATL', { dayHeadings: ['香港 → 亞特蘭提斯'] })]]),
      ...titledSite([['V', tour('V', { days: 3, dayHeadings: ['香港 → 中山', '高山賞紅葉', '珠海 → 香港'] })]]),
    ]);
    await runOperator(fakeScraper(pages), deps(fakeFetcher(pages)));
    expect(logLines).toEqual(expect.arrayContaining([
      'jetour: skipped OLD: no-departures',
      'jetour: skipped T1: duplicate tour code, keeping the first',
      'jetour: parse failure ATL: no-stops (1 unmatched word)',
      'jetour: day-line drops V: 高山 (too-far)',
    ]));
    noTitleText();
  });

  it('before the code is known: a page not fetched, gone, or rejected by its parser is named by its public address', async () => {
    const pages = titledSite([...goodTours(17), ['N', 'null'], ['BOOM', '{"boom":true}'], ['NF', 'unreachable']]);
    const gone = titled('T17');
    await runOperator(fakeScraper(pages, {
      fetchPage: async (fetcher, url) => (url === gone ? { skip: 'gone' } : fetcher.fetchText(url)),
      parse: html => {
        const value = JSON.parse(html) as (ScrapedTour & { boom?: boolean }) | null;
        if (value?.boom === true) throw new Error('selector not found');
        return value;
      },
    }), deps(fakeFetcher(pages)));
    const shown = (code: string) => `https://www.example.com/?tour=* ${logRef(titled(code))}`;
    expect(logLines).toEqual(expect.arrayContaining([
      `jetour: parse failure ${shown('N')}: parser returned null`,
      `jetour: parse failure ${shown('BOOM')}: parser threw: selector not found`,
      `jetour: skipped ${shown('NF')}: not fetched`,
      `jetour: skipped ${shown('T17')}: gone`,
    ]));
    noTitleText();
  });

  it('a thrown message that may quote what was read is hidden, with a reference', async () => {
    const message = 'Unexpected token, "測試之旅" is not valid JSON';
    const pages = site([...goodTours(9), ['BOOM', '{"boom":true}']]);
    await run(pages, NIGHT_1, {
      parse: html => {
        if (html.includes('boom')) throw new SyntaxError(message);
        return JSON.parse(html) as ScrapedTour;
      },
    });
    expect(logLines).toContain(`jetour: parse failure ${pageUrl('BOOM')}: parser threw: * ${logRef(message)}`);
    noTitleText();
  });

  it('a fetchPage or discover that throws such a message has it hidden too', async () => {
    const message = 'no answer for 測試之旅';
    const pages = site(goodTours(10));
    await runOperator(fakeScraper(pages, {
      fetchPage: async (fetcher, url) => { if (url === pageUrl('T1')) throw new Error(message); return fetcher.fetchText(url); },
    }), deps(fakeFetcher(pages)));
    expect(logLines).toContain(`jetour: skipped ${pageUrl('T1')}: not fetched (fetch threw: * ${logRef(message)})`);
    logLines = [];
    await runOperator(fakeScraper(pages, { discover: async () => { throw new Error(message); } }), deps(fakeFetcher(pages)));
    expect(logLines).toContain(`jetour: discover failed: * ${logRef(message)}`);
    noTitleText();
  });

  it('a page that fails the schema is named by its code when the code itself is valid, by its address when not', async () => {
    const pages = titledSite([...goodTours(18), ['BAD', tour('BAD', { days: 0 })], ['NOCODE', tour('no code', { days: 0 })]]);
    await runOperator(fakeScraper(pages), deps(fakeFetcher(pages)));
    const failures = logLines.filter(line => line.startsWith('jetour: parse failure '));
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatch(/^jetour: parse failure BAD: invalid scraped tour \(days: /);
    expect(failures[1]).toMatch(/^jetour: parse failure https:\/\/www\.example\.com\/\?tour=\* \(ref [0-9a-f]{8}\): invalid scraped tour \(code: /);
    noTitleText();
  });

  it('a dry run (logView DRY_RUN_LOG) prints the whole address with the same reference', async () => {
    const pages = titledSite([...goodTours(9), ['N', 'null']]);
    await runOperator(fakeScraper(pages), { ...deps(fakeFetcher(pages)), logView: DRY_RUN_LOG });
    expect(logLines).toContain(`jetour: parse failure ${titled('N')} ${logRef(titled('N'))}: parser returned null`);
  });

  it('gives discover the run\'s log view (PUBLIC_LOG unless the deps say otherwise)', async () => {
    const views: unknown[] = [];
    const pages = site(goodTours(1));
    const recording: Partial<OperatorScraper> = {
      discover: async (_fetcher, view) => { views.push(view); return [...pages.keys()]; },
    };
    await runOperator(fakeScraper(pages, recording), deps(fakeFetcher(pages)));
    await runOperator(fakeScraper(pages, recording), { ...deps(fakeFetcher(pages)), logView: DRY_RUN_LOG });
    expect(views).toEqual([PUBLIC_LOG, DRY_RUN_LOG]);
  });
});
