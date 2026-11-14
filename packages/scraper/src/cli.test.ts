import { readFile } from 'node:fs/promises';
import { rootCertificates } from 'node:tls';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ScrapedTour } from '@hktours/core';
import type { Db } from '@hktours/db';
import { createTestDb } from '@hktours/db/test';
import { parseArgs, runCli, proxyWanted, type CliDeps } from './cli';
import { SCRAPERS } from './operators';
import type { Fetcher, OperatorScraper } from './types';

const pageUrl = (code: string) => `https://www.jetour.com.hk/tour/${code}`;
/** 2026-11-13 in Hong Kong. */
const NOW = new Date('2026-11-12T18:00:00.000Z');

/** A valid jetour tour visiting Osaka and Kyoto with one December departure. */
function tour(code: string, patch: Partial<ScrapedTour> = {}): ScrapedTour {
  return {
    operatorId: 'jetour', code, url: pageUrl(code), title: '大阪京都6天', days: 6, nights: 5,
    dayHeadings: ['香港 → 大阪', '大阪 → 京都'], startPoint: null, endPoint: null, fromPriceHkd: 7999,
    departures: [{ date: '2026-12-18', priceHkd: 7999 }],
    ...patch,
  };
}

/** Each URL's page: the JSON of a ScrapedTour, or the string "null" for a page the parser rejects. */
type Site = Map<string, string>;
const site = (pages: [code: string, page: ScrapedTour | 'null'][]): Site =>
  new Map(pages.map(([code, page]) => [pageUrl(code), page === 'null' ? 'null' : JSON.stringify(page)]));

function fakeFetcher(pages: Site): Fetcher & { asked: string[] } {
  const asked: string[] = [];
  return { asked, fetchText: async url => { asked.push(url); return pages.get(url) ?? null; } };
}

/** A jetour scraper whose discover lists the site's URLs and whose parse reads the page as JSON. */
const fakeScraper = (pages: Site): OperatorScraper => ({
  id: 'jetour',
  discover: async () => [...pages.keys()],
  parse: html => JSON.parse(html) as ScrapedTour | null,
});

/** A Db that fails the test if it is used at all. */
function forbiddenDb(): Db & { used: string[] } {
  const used: string[] = [];
  const refuse = (what: string) => { used.push(what); throw new Error(`the real database was used: ${what}`); };
  return {
    used,
    query: async () => refuse('query'),
    transaction: async () => refuse('transaction'),
    exec: async () => refuse('exec'),
    close: async () => { used.push('close'); },
  };
}

/**
 * The in-memory database each runCli test's run gets, as its real or its dry-run database.
 * Created before each test, since starting PGlite takes seconds; runCli closes it, or afterEach does.
 */
let testDb: Db;
let testDbCloses = 0;

interface Harness { deps: Partial<CliDeps>; printed: string[]; fetcher: Fetcher & { asked: string[] }; madeDbWith: string[] }

/** Deps for a run over `pages`: both database factories hand out testDb. */
function harness(pages: Site, patch: Partial<CliDeps> = {}): Harness {
  const printed: string[] = [];
  const madeDbWith: string[] = [];
  const fetcher = fakeFetcher(pages);
  const deps: Partial<CliDeps> = {
    scrapers: { jetour: fakeScraper(pages) },
    makeFetcher: () => fetcher,
    makeDb: async url => { madeDbWith.push(url); return testDb; },
    makeDryRunDb: async () => testDb,
    print: line => printed.push(line),
    now: () => NOW,
    installProxy: () => { throw new Error('installProxy must not be called without a proxy variable'); },
    ...patch,
  };
  return { deps, printed, fetcher, madeDbWith };
}

const goodTours = (n: number) =>
  Array.from({ length: n }, (_, i) => [`T${i + 1}`, tour(`T${i + 1}`)] as [string, ScrapedTour]);

const DATABASE = { DATABASE_URL: 'postgres://example.invalid/tours' };

describe('parseArgs', () => {
  it.each([
    [['--operator', 'jetour'], { operator: 'jetour', dryRun: false, limit: null }],
    [['--operator', 'egl', '--dry-run', '--limit', '20'], { operator: 'egl', dryRun: true, limit: 20 }],
    [['--dry-run', '--operator', 'texpert'], { operator: 'texpert', dryRun: true, limit: null }],
    [['--', '--operator', 'jetour'], { operator: 'jetour', dryRun: false, limit: null }], // pnpm may pass a lone --
  ])('parseArgs(%j)', (argv, expected) => { expect(parseArgs(argv)).toEqual(expected); });

  it.each([
    [[]], [['--operator']], [['--operator', 'wingon']], [['--operator', 'jetour', '--limit', '0']],
    [['--operator', 'jetour', '--limit', 'x']], [['--operator', 'jetour', '--limit', '20']], // limit without dry-run
    [['--operator', 'jetour', '--bogus']],
    [['--operator', '--dry-run']], [['--operator', 'jetour', '--dry-run', '--limit']],
    [['--operator', 'jetour', '--dry-run', '--limit', '2.5']], [['--operator', 'jetour', '--operator', 'texpert']],
  ])('parseArgs(%j) is an error', argv => { expect(parseArgs(argv)).toHaveProperty('error'); });

  it.each([
    [['--operator', 'jetour', '--dry-run', '--limit', '5', '--limit', '20'], { error: '--limit is given twice' }],
    [['--operator', 'jetour', '--dry-run', '--limit', '5', '--limit', '5'], { error: '--limit is given twice' }],
    [['--operator', 'jetour', '--dry-run', '--dry-run'], { error: '--dry-run is given twice' }],
  ])('parseArgs(%j) rejects a repeated option', (argv, expected) => { expect(parseArgs(argv)).toEqual(expected); });
});

describe('runCli', () => {
  beforeEach(async () => {
    const db = await createTestDb();
    testDbCloses = 0;
    testDb = { ...db, close: async () => { if (testDbCloses++ === 0) await db.close(); } };
  });
  afterEach(async () => { await testDb.close(); });

  it('exits 2 when DATABASE_URL is missing for a real run', async () => {
    expect(await runCli(['--operator', 'jetour'], {})).toBe(2);
  });

  it('exits 2 for bad usage, before creating anything', async () => {
    const h = harness(site(goodTours(1)), {
      makeFetcher: () => { throw new Error('no fetcher on bad usage'); },
      makeDb: () => { throw new Error('no database on bad usage'); },
    });
    expect(await runCli(['--operator', 'wingon'], DATABASE, h.deps)).toBe(2);
    expect(h.printed.join('\n')).toContain('usage: pnpm scrape --operator <id> [--dry-run] [--limit N]');
  });

  it('exits 2 for an operator with no scraper registered', async () => {
    const h = harness(site(goodTours(1)), {
      scrapers: {},
      makeFetcher: () => { throw new Error('no fetcher for an unregistered operator'); },
      makeDb: () => { throw new Error('no database for an unregistered operator'); },
    });
    expect(await runCli(['--operator', 'jetour'], DATABASE, h.deps)).toBe(2);
    expect(h.printed.join('\n')).toContain('jetour');
  });

  // The brief's single test "exits 0 on a good run and 1 on a failed run", as two tests with one database each.
  it('exits 0 on a good run', async () => {
    const h = harness(site(goodTours(3)));
    expect(await runCli(['--operator', 'jetour'], DATABASE, h.deps)).toBe(0);
    expect(h.madeDbWith).toEqual([DATABASE.DATABASE_URL]);
    expect(h.fetcher.asked).toHaveLength(3);
    expect(h.printed.at(-1)).toBe('jetour: ok, 3 tours saved, 3 tour pages, 0 parse failures, 0 unmatched names');
    expect(testDbCloses).toBe(1);
  });

  it('passes DATABASE_CA_CERT on to the database, normalised', async () => {
    const pem = rootCertificates[0].trim(); // a real, public certificate
    const cas: Array<string | undefined> = [];
    const h = harness(site(goodTours(1)), { makeDb: async (_url, ca) => { cas.push(ca); return testDb; } });
    expect(await runCli(['--operator', 'jetour'], { ...DATABASE, DATABASE_CA_CERT: pem.replace(/\n/g, '\\n') }, h.deps)).toBe(0);
    expect(cas).toHaveLength(1);
    expect(cas[0] === `${pem}\n`, 'the CA passed on is not the normalised certificate').toBe(true);
  });

  it('an empty DATABASE_CA_CERT (an unset GitHub secret) is not supplied', async () => {
    const cas: Array<string | undefined> = [];
    const h = harness(site(goodTours(1)), { makeDb: async (_url, ca) => { cas.push(ca); return testDb; } });
    expect(await runCli(['--operator', 'jetour'], { ...DATABASE, DATABASE_CA_CERT: '' }, h.deps)).toBe(0);
    expect(cas).toEqual([undefined]);
  });

  it('exits 2 when DATABASE_CA_CERT is not a certificate, before fetching or connecting, without echoing it', async () => {
    const h = harness(site(goodTours(1)), {
      makeFetcher: () => { throw new Error('no fetcher with a bad DATABASE_CA_CERT'); },
      makeDb: () => { throw new Error('no database with a bad DATABASE_CA_CERT'); },
    });
    expect(await runCli(['--operator', 'jetour'], { ...DATABASE, DATABASE_CA_CERT: 'garbage-value-123' }, h.deps)).toBe(2);
    expect(h.printed.join('\n')).toContain('DATABASE_CA_CERT');
    expect(h.printed.join('\n')).not.toContain('garbage-value-123');
  });

  it('exits 1 on a failed run', async () => {
    const h = harness(site([['A', 'null'], ['B', 'null']]));
    expect(await runCli(['--operator', 'jetour'], DATABASE, h.deps)).toBe(1);
    expect(h.printed.at(-1)).toMatch(/^jetour: failed \(no-tours, too-many-parse-failures\)/);
    expect(testDbCloses).toBe(1);
  });

  it('creates exactly one fetcher', async () => {
    let fetchers = 0;
    const pages = site(goodTours(2));
    const h = harness(pages, { makeFetcher: () => { fetchers++; return fakeFetcher(pages); } });
    expect(await runCli(['--operator', 'jetour'], DATABASE, h.deps)).toBe(0);
    expect(fetchers).toBe(1);
  });

  it.each([
    ['jetour', undefined],
    ['texpert', { 'api.example.com': { 'x-key': 'k' } }],
  ])('makes the fetcher with the running scraper\'s request headers only (%s)', async (operator, expected) => {
    const pages = site(goodTours(2));
    const madeWith: unknown[] = [];
    const makeFetcher = (headers?: unknown) => { madeWith.push(headers); return fakeFetcher(pages); };
    const scrapers = {
      jetour: fakeScraper(pages),
      texpert: { ...fakeScraper(pages), id: 'texpert' as const, requestHeaders: { 'api.example.com': { 'x-key': 'k' } } },
    };
    await runCli(['--operator', operator, '--dry-run'], {}, harness(pages, { scrapers, makeFetcher }).deps);
    expect(madeWith).toEqual([expected]);
  });

  it('dry-run prints unmatched names and writes nothing to the real database', async () => {
    const realDb = forbiddenDb();
    const withAtlantis = (code: string) => tour(code, { dayHeadings: ['香港 → 大阪', '大阪 → 亞特蘭提斯'] });
    const pages = site([
      ['A', withAtlantis('A')],
      ['B', withAtlantis('B')],
      ['C', tour('C', { dayHeadings: ['香港 → 京都 → 天空之城'] })],
      ['D', tour('D')],
    ]);
    let realDbRequested = false;
    const h = harness(pages, { makeDb: () => { realDbRequested = true; return Promise.resolve(realDb); } });

    expect(await runCli(['--operator', 'jetour', '--dry-run'], DATABASE, h.deps)).toBe(0);
    expect(realDbRequested).toBe(false);
    expect(realDb.used).toEqual([]);
    expect(testDbCloses).toBe(1); // the dry-run database is closed too

    const out = h.printed.join('\n');
    expect(out).toContain('tours saved: 4');
    expect(out).toContain('parse failures: 0');
    const atlantis = h.printed.indexOf('  2 亞特蘭提斯');
    const skyCity = h.printed.indexOf('  1 天空之城');
    expect(atlantis).toBeGreaterThan(-1);
    expect(skyCity).toBeGreaterThan(atlantis); // most frequent first
  });

  it('dry-run counts parse failures and keeps the unmatched names of a run that failed its checks', async () => {
    const pages = site([
      ['A', tour('A', { dayHeadings: ['香港 → 亞特蘭提斯'] })],
      ['B', tour('B', { dayHeadings: ['香港 → 亞特蘭提斯'] })],
      ['C', tour('C')],
    ]);
    const h = harness(pages);
    expect(await runCli(['--operator', 'jetour', '--dry-run'], {}, h.deps)).toBe(1);
    const out = h.printed.join('\n');
    expect(out).toContain('tours saved: 0');
    expect(out).toContain('parse failures: 2 (66.7% of 3 tour pages fetched)');
    expect(h.printed).toContain('  2 亞特蘭提斯');
  });

  it('dry-run prints each page with its route, for checking matches by eye', async () => {
    const h = harness(site([['A', tour('A')], ['N', 'null']]));
    await runCli(['--operator', 'jetour', '--dry-run'], {}, h.deps);
    const pageLines = h.printed.filter(line => line.startsWith('page ')).map(line => JSON.parse(line.slice(5)));
    expect(pageLines).toEqual([
      {
        url: pageUrl('A'), code: 'A', result: 'ok', route: ['大阪 (日本)', '京都 (日本)'], unmatched: [],
        dayHeadings: ['香港 → 大阪', '大阪 → 京都'], startPoint: null, endPoint: null,
      },
      { url: pageUrl('N'), result: 'parser-null' },
    ]);
  });

  it('dry-run checks the run against the scraper\'s floor for first runs', async () => {
    const pages = site(goodTours(3));
    const h = harness(pages, { scrapers: { jetour: { ...fakeScraper(pages), minExpectedTours: 4 } } });
    expect(await runCli(['--operator', 'jetour', '--dry-run'], {}, h.deps)).toBe(1);
    expect(h.printed).toContain('run checks: failed (below-minimum)');
  });

  it('dry-run fetches through the scraper\'s own fetchPage when it has one', async () => {
    const pages = site(goodTours(1));
    const fetchPage = vi.fn(async (fetcher: Fetcher, url: string) => fetcher.fetchText(url));
    const h = harness(pages, { scrapers: { jetour: { ...fakeScraper(pages), fetchPage } } });
    expect(await runCli(['--operator', 'jetour', '--dry-run'], {}, h.deps)).toBe(0);
    expect(fetchPage).toHaveBeenCalledWith(h.fetcher, pageUrl('T1'), '2026-11-13'); // the run's today in Hong Kong
  });

  it('dry-run with --limit fetches only that many pages', async () => {
    const h = harness(site(goodTours(5)));
    expect(await runCli(['--operator', 'jetour', '--dry-run', '--limit', '2'], {}, h.deps)).toBe(0);
    expect(h.fetcher.asked).toEqual([pageUrl('T1'), pageUrl('T2')]);
    expect(h.printed.join('\n')).toContain('tour pages discovered: 5 (limited to the first 2)');
  });

  it('installs the proxy dispatcher before the first request when a proxy variable is set', async () => {
    const events: string[] = [];
    const pages = site(goodTours(1));
    const inner = fakeFetcher(pages);
    const h = harness(pages, {
      installProxy: () => { events.push('proxy'); },
      makeFetcher: () => ({ fetchText: url => { events.push('fetch'); return inner.fetchText(url); } }),
    });
    expect(await runCli(['--operator', 'jetour', '--dry-run'], { HTTPS_PROXY: 'http://127.0.0.1:3128' }, h.deps)).toBe(0);
    expect(events).toEqual(['proxy', 'fetch']);
  });

  it('leaves the global dispatcher alone when no proxy variable is set', async () => {
    const installProxy = vi.fn();
    const h = harness(site(goodTours(1)), { installProxy });
    expect(await runCli(['--operator', 'jetour', '--dry-run'], { NO_PROXY: 'localhost' }, h.deps)).toBe(0);
    expect(installProxy).not.toHaveBeenCalled();
  });
});

describe('proxyWanted', () => {
  it.each([
    [{ HTTPS_PROXY: 'http://proxy:3128' }, true],
    [{ HTTP_PROXY: 'http://proxy:3128' }, true],
    [{ https_proxy: 'http://proxy:3128' }, true],
    [{ http_proxy: 'http://proxy:3128' }, true],
    [{ HTTPS_PROXY: '' }, false],
    [{ NO_PROXY: '*' }, false],
    [{}, false],
  ])('proxyWanted(%j) is %s', (env, expected) => { expect(proxyWanted(env)).toBe(expected); });
});

describe('SCRAPERS', () => {
  it('holds exactly the approved operators, each under its own id', () => {
    expect(Object.keys(SCRAPERS).sort()).toEqual(['bigline', 'egl', 'jetour', 'texpert']);
    for (const [id, scraper] of Object.entries(SCRAPERS)) expect(scraper.id).toBe(id);
  });

  it('gives each operator a floor for runs with no history, about a third of the tours seen with dates on sale', () => {
    expect(SCRAPERS.jetour?.minExpectedTours).toBe(35);
    expect(SCRAPERS.texpert?.minExpectedTours).toBe(40);
    expect(SCRAPERS.egl?.minExpectedTours).toBe(165);
    expect(SCRAPERS.bigline?.minExpectedTours).toBe(100); // provisional, until Big Line's measured crawl
  });

  it('only Big Line declares extra request headers, and only its one approved header for its API host', () => {
    for (const [id, scraper] of Object.entries(SCRAPERS)) {
      expect(scraper.requestHeaders, id).toEqual(id === 'bigline' ? { 'api.biglinehk.com': { tenantCode: 'DH' } } : undefined);
    }
  });

  it('the nightly workflow scrapes every registered operator, except those awaiting their measured crawl', async () => {
    /** Registered, but added to the nightly matrix only after a measured crawl has set its first-run floor. */
    const awaitingMeasuredCrawl = ['bigline'];
    const workflow = await readFile(new URL('../../../.github/workflows/nightly-scrape.yml', import.meta.url), 'utf8');
    const matrix = /^\s+operator: \[([^\]]*)\]\s*$/m.exec(workflow);
    expect(matrix, 'operator matrix line').not.toBeNull();
    expect(matrix![1].split(',').map(id => id.trim()).sort())
      .toEqual(Object.keys(SCRAPERS).filter(id => !awaitingMeasuredCrawl.includes(id)).sort());
  });

  it('the nightly schedule is on, once a day at 18:17 UTC (02:17 Hong Kong), off the hour', async () => {
    const workflow = await readFile(new URL('../../../.github/workflows/nightly-scrape.yml', import.meta.url), 'utf8');
    expect(workflow).toMatch(/^ {2}schedule:\s*$/m);
    const crons = [...workflow.matchAll(/^\s*-\s*cron:\s*'([^']*)'/gm)].map(match => match[1]);
    expect(crons).toEqual(['17 18 * * *']);
    expect(workflow).not.toMatch(/^\s*#\s*-\s*cron:/m);
  });
});
