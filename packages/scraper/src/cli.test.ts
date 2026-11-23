import { readdir, readFile } from 'node:fs/promises';
import { rootCertificates } from 'node:tls';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ScrapedTour } from '@hktours/core';
import type { Db } from '@hktours/db';
import { createTestDb } from '@hktours/db/test';
import { parseArgs, runCli, proxyWanted, type CliDeps } from './cli';
import { SCRAPERS } from './operators';
import { addressRefId, DRY_RUN_LOG, logRef, PUBLIC_LOG } from './public-log';
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

const nightlyWorkflow = () => readFile(new URL('../../../.github/workflows/nightly-scrape.yml', import.meta.url), 'utf8');

/** One job of a workflow, as text: from its `  <id>:` line to the next line indented two spaces or less. */
function jobOf(workflow: string, id: string): string {
  const lines = workflow.split('\n');
  const start = lines.indexOf(`  ${id}:`);
  if (start === -1) throw new Error(`no job ${id}`);
  const end = lines.findIndex((line, i) => i > start && /^ {0,2}\S/.test(line));
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

/** One line of a workflow file as yamlLines reads it. */
interface YamlLine {
  /** Its line number, from 1. */
  n: number;
  /** The keys leading to the line, its own key last; `-<n>` stands for the list item that starts on line n. */
  path: string[];
  /** The line's own key; null for a list item without one (`- a`, `- { … }`) and for a line inside a block scalar. */
  key: string | null;
  /** What follows the key (or the `- `), without a trailing comment; for a line inside a block scalar, its text. */
  value: string;
  /** True for a line inside a block scalar (the shell lines of `run: |`). */
  inBlock: boolean;
}

/**
 * Each line of a workflow file that is not blank or a comment, with the keys leading to it: enough of YAML for the
 * forms the workflows use (block mappings and lists, one-line values, flow lists and mappings on one line, block
 * scalars), without a YAML library. Malformed files are workflowProblems' concern.
 */
function yamlLines(text: string): YamlLine[] {
  const lines: YamlLine[] = [];
  const stack: { indent: number; name: string }[] = [];
  const popTo = (indent: number) => {
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
  };
  let block: { indent: number; path: string[] } | null = null;
  text.split('\n').forEach((line, i) => {
    const indent = line.length - line.trimStart().length;
    if (block !== null) {
      if (line.trim() === '') return;
      if (indent > block.indent) {
        lines.push({ n: i + 1, path: block.path, key: null, value: line.trim(), inBlock: true });
        return;
      }
      block = null;
    }
    if (line.trim() === '' || line.trimStart().startsWith('#')) return;
    let rest = line.slice(indent);
    let keyIndent = indent;
    if (rest === '-' || rest.startsWith('- ')) {
      popTo(indent);
      stack.push({ indent, name: `-${i + 1}` });
      keyIndent = indent + 2;
      rest = rest.slice(2);
    }
    const key = /^([A-Za-z_][\w-]*):(?: +|$)(.*)$/.exec(rest);
    const value = (key ? key[2] : rest).replace(/(^| )#.*$/, '').trim();
    if (key) {
      popTo(keyIndent);
      stack.push({ indent: keyIndent, name: key[1] });
    }
    const path = stack.map(entry => entry.name);
    lines.push({ n: i + 1, path, key: key ? key[1] : null, value, inBlock: false });
    if (key && /^[|>][-+]?$/.test(value)) block = { indent: keyIndent, path };
  });
  return lines;
}

/**
 * The matrix of a job, which must be a list of `include` entries, each with an `operator` (an id) and `minutes` (a
 * whole number) and nothing else, written on one line (`- { operator: egl, minutes: 170 }`, a comment after it
 * allowed) or as a block (`- operator: egl` and `minutes: 170` below it). Any other line in the matrix fails the test,
 * rather than being skipped.
 */
function matrixEntries(job: string): { operator: string; minutes: number }[] {
  const lines = yamlLines(job);
  const matrix = lines.find(line => line.key === 'matrix' && line.path.at(-2) === 'strategy');
  if (matrix === undefined) throw new Error('no matrix');
  const depth = matrix.path.length;
  const inside = lines.filter(line => line.path.length > depth && line.path.slice(0, depth).join('\n') === matrix.path.join('\n'));
  const entries = new Map<string, Record<string, string>>();
  const add = (line: YamlLine, item: string, key: string, value: string) => {
    const fields = entries.get(item) ?? {};
    entries.set(item, fields);
    if (Object.hasOwn(fields, key)) throw new Error(`line ${line.n}: ${key} given twice in one matrix entry`);
    fields[key] = value;
  };
  for (const line of inside) {
    const [list, item, field, ...more] = line.path.slice(depth);
    if (list !== 'include' || more.length > 0) throw new Error(`line ${line.n}: not a matrix entry`);
    if (item === undefined) {
      if (line.value !== '') throw new Error(`line ${line.n}: include is not a list`);
    } else if (!item.startsWith('-')) {
      throw new Error(`line ${line.n}: include is not a list`);
    } else if (field !== undefined) {
      add(line, item, field, line.value);
    } else {
      const flow = /^\{(.*)\}$/.exec(line.value);
      if (!flow) throw new Error(`line ${line.n}: not a matrix entry`);
      for (const pair of flow[1].split(',')) {
        const entry = /^\s*([A-Za-z_][\w-]*):\s*(\S+)\s*$/.exec(pair);
        if (!entry) throw new Error(`line ${line.n}: not a matrix entry`);
        add(line, item, entry[1], entry[2]);
      }
    }
  }
  if (entries.size === 0) throw new Error('an empty matrix');
  return [...entries.values()].map(fields => {
    const keys = Object.keys(fields).sort().join(', ');
    if (keys !== 'minutes, operator' || !/^[a-z]+$/.test(fields.operator) || !/^[1-9]\d*$/.test(fields.minutes)) {
      throw new Error(`not a matrix entry: ${JSON.stringify(fields)}`);
    }
    return { operator: fields.operator, minutes: Number(fields.minutes) };
  });
}

/** Each job of a workflow with the jobs it needs, in any of YAML's forms (`needs: a`, `needs: [a, b]`, a block list). */
function needsOf(workflow: string): Record<string, string[]> {
  const lines = yamlLines(workflow);
  const needs: Record<string, string[]> = {};
  for (const line of lines) {
    if (line.path[0] !== 'jobs' || line.path.length < 2) continue;
    const job = line.path[1];
    needs[job] ??= [];
    if (line.path[2] !== 'needs') continue;
    if (line.path.length === 3) {
      const list = /^\[(.*)\]$/.exec(line.value);
      if (list) needs[job].push(...list[1].split(',').map(id => id.trim()).filter(id => id !== ''));
      else if (line.value !== '') needs[job].push(line.value);
    } else if (line.path.length === 4 && line.key === null) {
      needs[job].push(line.value);
    } else {
      throw new Error(`line ${line.n}: not a job id under needs`);
    }
  }
  return needs;
}

/**
 * What the workflows must keep for the owner's safety rules (task 61 review, finding I1): a secret only in a step's
 * `env` (never at job or workflow level, in `with`, or in a command); top-level permissions `contents: read` and no
 * other permissions anywhere; every action pinned to a 40-character commit hash; no command that prints a secret's
 * variable (a test such as `[ -n "$X" ]` or `test -n "$X"` reads it without printing it) or runs `env`, `set` or
 * `printenv` bare, `printenv` at all, or `set -x`. For the nightly workflow also: `fail-fast: false` on every job with a
 * strategy, `cancel-in-progress: false`, and `persist-credentials: false` on every checkout. Returns the problems.
 */
function safetyProblems(text: string, opts: { nightly: boolean }): string[] {
  const problems: string[] = [];
  const lines = yamlLines(text);
  const isStepEnv = (path: string[]) =>
    path.length === 6 && path[0] === 'jobs' && path[2] === 'steps' && path[3].startsWith('-') && path[4] === 'env';
  const secretVariables = new Set<string>();
  for (const line of lines) {
    if (!/\bsecrets\./.test(line.value)) continue;
    if (line.inBlock || line.key === null || !isStepEnv(line.path)) problems.push(`line ${line.n}: a secret outside a step's env`);
    else secretVariables.add(line.key);
  }
  const permissions = lines.filter(line => line.path.includes('permissions')).map(line => `${line.path.join('.')}: ${line.value}`);
  if (permissions.join('\n') !== 'permissions: \npermissions.contents: read') {
    problems.push(`permissions other than contents: read at the top (${permissions.join('; ')})`);
  }
  for (const line of lines) {
    if (line.key === 'uses' && !line.inBlock && !/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(line.value)) {
      problems.push(`line ${line.n}: an action not pinned to a commit`);
    }
  }
  const START = String.raw`(?:^|[;&|(){}]|\b(?:then|do|else)\b)\s*`;
  const BARE = new RegExp(`${START}(?:env|set|printenv)\\s*(?:$|[;&|)}])`);
  const TRACE = new RegExp(`${START}set\\s+(?:-[A-Za-z]*[xv]|-o\\s+(?:xtrace|verbose))`);
  const commands = lines.filter(line => (line.inBlock && line.path.at(-1) === 'run') || (line.key === 'run' && !/^[|>]/.test(line.value)));
  for (const line of commands) {
    const shell = line.value;
    if (BARE.test(shell) || /\bprintenv\b/.test(shell) || TRACE.test(shell)) problems.push(`line ${line.n}: env, set or printenv`);
    const shown = shell.replace(/\[\[.*?\]\]/g, '').replace(/\[\s.*?\s\]/g, '').replace(/\btest\s[^;&|)]*/g, '');
    const printsSecret = [...secretVariables].some(name => new RegExp(String.raw`\$\{?${name}\b`).test(shown));
    if (printsSecret && /\b(?:echo|printf|cat|tee)\b/.test(shown)) problems.push(`line ${line.n}: prints a secret`);
  }
  if (opts.nightly) {
    const value = (path: string[]) => lines.find(line => line.path.join('\n') === path.join('\n'))?.value;
    for (const job of new Set(lines.filter(line => line.path[2] === 'strategy').map(line => line.path[1]))) {
      if (value(['jobs', job, 'strategy', 'fail-fast']) !== 'false') problems.push(`job ${job}: no fail-fast: false`);
    }
    if (value(['concurrency', 'cancel-in-progress']) !== 'false') problems.push('no cancel-in-progress: false');
    for (const line of lines) {
      if (line.key !== 'uses' || !line.value.startsWith('actions/checkout@')) continue;
      if (value([...line.path.slice(0, -1), 'with', 'persist-credentials']) !== 'false') {
        problems.push(`line ${line.n}: a checkout without persist-credentials: false`);
      }
    }
  }
  return problems;
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
  allowedHosts: ['www.jetour.com.hk'],
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

/** The site's identity every run needs: invented values (nothing here reads the real environment). */
const IDENTITY = { SITE_URL: 'https://example.invalid', CONTACT_EMAIL: 'bot@example.invalid' };
/** The User-Agent a run with IDENTITY sends. */
const IDENTITY_UA = 'tour-comparison-bot/0.1 (+https://example.invalid; bot@example.invalid)';
const DATABASE = { ...IDENTITY, DATABASE_URL: 'postgres://example.invalid/tours' };

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

describe('runCli without the site\'s identity (task 49)', () => {
  /**
   * Everything a run could use to make a request, each failing the test if it is used at all: the fetcher, the
   * proxy, both databases and the scraper itself; and fetch, for the default fetcher (the second form).
   */
  function forbiddingEverything(withDefaultFetcher: boolean) {
    const used: string[] = [];
    const refuse = (what: string) => { used.push(what); throw new Error(`used without an identity: ${what}`); };
    const scraper: OperatorScraper = {
      id: 'jetour', allowedHosts: ['shop.invalid'], discover: async () => refuse('discover'), parse: () => refuse('parse'),
    };
    const h = harness(new Map(), {
      scrapers: { jetour: scraper },
      makeFetcher: () => refuse('makeFetcher'),
      makeDb: async () => refuse('makeDb'),
      makeDryRunDb: async () => refuse('makeDryRunDb'),
      installProxy: () => refuse('installProxy'),
    });
    if (withDefaultFetcher) delete h.deps.makeFetcher;
    const fetchCalls: string[] = [];
    vi.stubGlobal('fetch', async (input: unknown) => { fetchCalls.push(String(input)); return refuse('fetch'); });
    return { h, used, fetchCalls };
  }
  afterEach(() => { vi.unstubAllGlobals(); });

  /** Each environment, with the variable its one line must name and what the line says. */
  const cases: Array<[name: string, env: Record<string, string>, line: RegExp]> = [
    ['SITE_URL missing', { CONTACT_EMAIL: IDENTITY.CONTACT_EMAIL }, /^SITE_URL is not set: /],
    ['SITE_URL empty (an unset GitHub secret)', { ...IDENTITY, SITE_URL: '' }, /^SITE_URL is not set: /],
    ['CONTACT_EMAIL missing', { SITE_URL: IDENTITY.SITE_URL }, /^CONTACT_EMAIL is not set: /],
    ['CONTACT_EMAIL empty (an unset GitHub secret)', { ...IDENTITY, CONTACT_EMAIL: '' }, /^CONTACT_EMAIL is not set: /],
    ['both missing', {}, /^SITE_URL is not set: .*; CONTACT_EMAIL is not set: /],
    ['SITE_URL with a trailing slash', { ...IDENTITY, SITE_URL: 'https://example.invalid/' }, /^SITE_URL ends with a slash: /],
    ['SITE_URL over http', { ...IDENTITY, SITE_URL: 'http://example.invalid' }, /^SITE_URL must start with https:\/\/ /],
    ['SITE_URL with a path', { ...IDENTITY, SITE_URL: 'https://example.invalid/bot' }, /^SITE_URL has a path: /],
    ['SITE_URL the URL standard reads as an IP address', { ...IDENTITY, SITE_URL: 'https://example.123' }, /^SITE_URL is not an address the URL standard reads as written: /],
    ['SITE_URL with a header injection', { ...IDENTITY, SITE_URL: 'https://example.invalid\r\nX-Evil: 1' }, /^SITE_URL holds a space, a control character/],
    ['CONTACT_EMAIL not an address', { ...IDENTITY, CONTACT_EMAIL: 'example.invalid' }, /^CONTACT_EMAIL is not an e-mail address: /],
    ['CONTACT_EMAIL with a parenthesis', { ...IDENTITY, CONTACT_EMAIL: 'bot)@example.invalid' }, /^CONTACT_EMAIL is not an e-mail address: /],
    ['CONTACT_EMAIL with a line break', { ...IDENTITY, CONTACT_EMAIL: 'bot@example.invalid\nX-Evil: 1' }, /^CONTACT_EMAIL holds a space, a control character/],
  ];
  const runs: Array<[kind: string, argv: string[]]> = [
    ['a real run', ['--operator', 'jetour']],
    ['a dry run', ['--operator', 'jetour', '--dry-run']],
    ['a limited dry run', ['--operator', 'jetour', '--dry-run', '--limit', '1']],
  ];

  describe.each(runs)('%s', (_kind, argv) => {
    it.each(cases)('%s: exits 2 with one line naming it, before any fetcher, proxy, database or request', async (_name, identity, line) => {
      // A database and a proxy are set, to show that neither is even looked at.
      const env = { DATABASE_URL: 'postgres://example.invalid/tours', HTTPS_PROXY: 'http://127.0.0.1:3128', ...identity };
      const { h, used, fetchCalls } = forbiddingEverything(false);
      expect(await runCli(argv, env, h.deps)).toBe(2);
      expect(h.printed).toHaveLength(1);
      expect(h.printed[0]).toMatch(line);
      expect(used).toEqual([]);
      expect(fetchCalls).toEqual([]);
    });

    it.each(cases)('%s: with the real default fetcher too, fetch is never called', async (_name, identity) => {
      const { h, used, fetchCalls } = forbiddingEverything(true);
      expect(await runCli(argv, identity, h.deps)).toBe(2);
      expect(h.printed).toHaveLength(1);
      expect(used).toEqual([]);
      expect(fetchCalls).toEqual([]);
    });
  });

  it('the line never repeats a value it refuses', async () => {
    const { h } = forbiddingEverything(false);
    expect(await runCli(['--operator', 'jetour', '--dry-run'], { SITE_URL: 'https://hunter2.invalid/x', CONTACT_EMAIL: 'hunter3' }, h.deps)).toBe(2);
    expect(h.printed).toHaveLength(1);
    expect(h.printed[0]).toMatch(/^SITE_URL has a path: .*; CONTACT_EMAIL is not an e-mail address: /);
    expect(h.printed[0]).not.toMatch(/hunter/);
  });

  it('is checked before anything else, even the arguments: bad usage without an identity names the identity', async () => {
    const { h, used } = forbiddingEverything(false);
    expect(await runCli(['--operator', 'wingon'], {}, h.deps)).toBe(2);
    expect(h.printed).toHaveLength(1);
    expect(h.printed[0]).toMatch(/^SITE_URL is not set: /);
    expect(used).toEqual([]);
  });

  it('reads the identity from the environment object it is given, never from process.env', async () => {
    vi.stubEnv('SITE_URL', 'https://example.invalid');
    vi.stubEnv('CONTACT_EMAIL', 'bot@example.invalid');
    try {
      const { h } = forbiddingEverything(false);
      expect(await runCli(['--operator', 'jetour', '--dry-run'], {}, h.deps)).toBe(2);
      expect(h.printed[0]).toMatch(/^SITE_URL is not set: /);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('runCli', () => {
  beforeEach(async () => {
    const db = await createTestDb();
    testDbCloses = 0;
    testDb = { ...db, close: async () => { if (testDbCloses++ === 0) await db.close(); } };
  });
  afterEach(async () => { await testDb.close(); });

  it('exits 2 when DATABASE_URL is missing for a real run', async () => {
    expect(await runCli(['--operator', 'jetour'], IDENTITY)).toBe(2);
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

  it('makes its one fetcher with the User-Agent built from SITE_URL and CONTACT_EMAIL, trimmed (task 49)', async () => {
    const pages = site(goodTours(1));
    const agents: string[] = [];
    const h = harness(pages, { makeFetcher: userAgent => { agents.push(userAgent); return fakeFetcher(pages); } });
    const env = { SITE_URL: ' https://example.invalid\n', CONTACT_EMAIL: 'bot@example.invalid\r\n' };
    expect(await runCli(['--operator', 'jetour', '--dry-run'], env, h.deps)).toBe(0);
    expect(agents).toEqual([IDENTITY_UA]);
  });

  it('the default fetcher sends that User-Agent, robots.txt included (task 49)', async () => {
    // fetch is replaced: robots.txt disallows everything, so the only request is robots.txt itself.
    const sent: Array<[string, string | null]> = [];
    vi.stubGlobal('fetch', async (input: unknown, init?: RequestInit) => {
      sent.push([String(input), new Headers(init?.headers).get('user-agent')]);
      return new Response('User-agent: *\nDisallow: /', { status: 200 });
    });
    try {
      const asking: OperatorScraper = {
        id: 'jetour', allowedHosts: ['shop.invalid'], parse: () => null,
        discover: async fetcher => { await fetcher.fetchText('https://shop.invalid/a'); return []; },
      };
      const h = harness(new Map(), { scrapers: { jetour: asking } });
      delete h.deps.makeFetcher;
      await runCli(['--operator', 'jetour', '--dry-run'], IDENTITY, h.deps);
      expect(sent).toEqual([['https://shop.invalid/robots.txt', IDENTITY_UA]]);
    } finally {
      vi.unstubAllGlobals();
    }
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
    const makeFetcher = (_userAgent: string, headers?: unknown) => { madeWith.push(headers); return fakeFetcher(pages); };
    const scrapers = {
      jetour: fakeScraper(pages),
      texpert: { ...fakeScraper(pages), id: 'texpert' as const, requestHeaders: { 'api.example.com': { 'x-key': 'k' } } },
    };
    await runCli(['--operator', operator, '--dry-run'], IDENTITY, harness(pages, { scrapers, makeFetcher }).deps);
    expect(madeWith).toEqual([expected]);
  });

  it.each([['jetour', ['www.jetour.com.hk']], ['texpert', ['api.example.invalid', 'www.example.invalid']]])(
    'makes the fetcher with the running scraper\'s allowed hosts only (%s, task 66)', async (operator, expected) => {
      const pages = site(goodTours(2));
      const madeWith: unknown[] = [];
      const makeFetcher: CliDeps['makeFetcher'] = (_userAgent, _headers, _logView, allowedHosts) => {
        madeWith.push(allowedHosts);
        return fakeFetcher(pages);
      };
      const scrapers = {
        jetour: fakeScraper(pages),
        texpert: { ...fakeScraper(pages), id: 'texpert' as const, allowedHosts: ['api.example.invalid', 'www.example.invalid'] },
      };
      await runCli(['--operator', operator, '--dry-run'], IDENTITY, harness(pages, { scrapers, makeFetcher }).deps);
      expect(madeWith).toEqual([expected]);
    });

  it('the default fetcher requests nothing off the running scraper\'s hosts, not even robots.txt (task 66)', async () => {
    const sent: string[] = [];
    vi.stubGlobal('fetch', async (input: unknown) => {
      sent.push(String(input));
      return new Response('User-agent: *\nDisallow: /', { status: 200 });
    });
    try {
      const asking: OperatorScraper = {
        id: 'jetour', allowedHosts: ['shop.invalid'], parse: () => null,
        discover: async fetcher => {
          await fetcher.fetchText('https://elsewhere.invalid/a');
          await fetcher.fetchText('https://shop.invalid/a');
          return [];
        },
      };
      const h = harness(new Map(), { scrapers: { jetour: asking } });
      delete h.deps.makeFetcher;
      await runCli(['--operator', 'jetour', '--dry-run'], IDENTITY, h.deps);
      expect(sent).toEqual(['https://shop.invalid/robots.txt']);
      expect(h.printed).toContain(
        'not fetched https://elsewhere.invalid/a: elsewhere.invalid is not one of the allowed hosts, so nothing was requested');
    } finally {
      vi.unstubAllGlobals();
    }
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
    expect(await runCli(['--operator', 'jetour', '--dry-run'], IDENTITY, h.deps)).toBe(1);
    const out = h.printed.join('\n');
    expect(out).toContain('tours saved: 0');
    expect(out).toContain('parse failures: 2 (66.7% of 3 tour pages fetched)');
    expect(h.printed).toContain('  2 亞特蘭提斯');
  });

  it('dry-run prints each page with its route, for checking matches by eye', async () => {
    const h = harness(site([['A', tour('A')], ['N', 'null']]));
    await runCli(['--operator', 'jetour', '--dry-run'], IDENTITY, h.deps);
    const pageLines = h.printed.filter(line => line.startsWith('page ')).map(line => JSON.parse(line.slice(5)));
    expect(pageLines).toEqual([
      {
        url: pageUrl('A'), ref: addressRefId(pageUrl('A')), code: 'A', result: 'ok', route: ['大阪 (日本)', '京都 (日本)'], unmatched: [],
        dayHeadings: ['香港 → 大阪', '大阪 → 京都'], startPoint: null, endPoint: null, days: 6, dayHeadingsDropped: [],
      },
      { url: pageUrl('N'), ref: addressRefId(pageUrl('N')), result: 'parser-null' },
    ]);
  });

  it('dry-run checks the run against the scraper\'s floor for first runs', async () => {
    const pages = site(goodTours(3));
    const h = harness(pages, { scrapers: { jetour: { ...fakeScraper(pages), minExpectedTours: 4 } } });
    expect(await runCli(['--operator', 'jetour', '--dry-run'], IDENTITY, h.deps)).toBe(1);
    expect(h.printed).toContain('run checks: failed (below-minimum)');
  });

  it('dry-run fetches through the scraper\'s own fetchPage when it has one', async () => {
    const pages = site(goodTours(1));
    const fetchPage = vi.fn(async (fetcher: Fetcher, url: string) => fetcher.fetchText(url));
    const h = harness(pages, { scrapers: { jetour: { ...fakeScraper(pages), fetchPage } } });
    expect(await runCli(['--operator', 'jetour', '--dry-run'], IDENTITY, h.deps)).toBe(0);
    expect(fetchPage).toHaveBeenCalledWith(h.fetcher, pageUrl('T1'), '2026-11-13'); // the run's today in Hong Kong
  });

  it('dry-run with --limit fetches only that many pages', async () => {
    const h = harness(site(goodTours(5)));
    expect(await runCli(['--operator', 'jetour', '--dry-run', '--limit', '2'], IDENTITY, h.deps)).toBe(0);
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
    expect(await runCli(['--operator', 'jetour', '--dry-run'], { ...IDENTITY, HTTPS_PROXY: 'http://127.0.0.1:3128' }, h.deps)).toBe(0);
    expect(events).toEqual(['proxy', 'fetch']);
  });

  it('leaves the global dispatcher alone when no proxy variable is set', async () => {
    const installProxy = vi.fn();
    const h = harness(site(goodTours(1)), { installProxy });
    expect(await runCli(['--operator', 'jetour', '--dry-run'], { ...IDENTITY, NO_PROXY: 'localhost' }, h.deps)).toBe(0);
    expect(installProxy).not.toHaveBeenCalled();
  });

  describe('the public run log (task 36)', () => {
    /** An address like Charming's older ones: an invented title, percent-encoded. */
    const titled = `https://www.jetour.com.hk/?tour=${encodeURIComponent('5天測試之旅')}`;
    const titledSite = (): Site => new Map([...site(goodTours(9)), [titled, 'null']]);

    it('a real run makes its fetcher with PUBLIC_LOG and prints a page address only in its public form', async () => {
      const views: unknown[] = [];
      const pages = titledSite();
      const h = harness(pages, { makeFetcher: (_userAgent, _headers, logView) => { views.push(logView); return fakeFetcher(pages); } });
      expect(await runCli(['--operator', 'jetour'], DATABASE, h.deps)).toBe(0);
      expect(views).toEqual([PUBLIC_LOG]);
      expect(h.printed).toContain(`jetour: parse failure https://www.jetour.com.hk/?tour=* ${logRef(titled)}: parser returned null`);
      for (const line of h.printed) expect(line).not.toContain('%');
    });

    it('a dry run makes its fetcher with DRY_RUN_LOG and prints the whole address with the same reference', async () => {
      const views: unknown[] = [];
      const pages = titledSite();
      const h = harness(pages, { makeFetcher: (_userAgent, _headers, logView) => { views.push(logView); return fakeFetcher(pages); } });
      await runCli(['--operator', 'jetour', '--dry-run'], IDENTITY, h.deps);
      expect(views).toEqual([DRY_RUN_LOG]);
      expect(h.printed).toContain(`jetour: parse failure ${titled} ${logRef(titled)}: parser returned null`);
    });

    it('a real run that stops on an unexpected error prints the error\'s kind and where, never its message, and exits 1', async () => {
      const message = 'value too long: "5天測試之旅"';
      const error = Object.assign(new Error(message), { code: '22001', detail: 'Failing row contains (5天測試之旅)' });
      const h = harness(site(goodTours(2)), {
        makeDb: async () => ({ ...testDb, query: async () => { throw error; } }),
      });
      expect(await runCli(['--operator', 'jetour'], DATABASE, h.deps)).toBe(1);
      expect(h.printed[0]).toBe(`jetour: the run stopped on an unexpected error: Error (code 22001): * ${logRef(message)}`);
      expect(h.printed.slice(1).every(line => line.startsWith('    at '))).toBe(true); // where it happened: the stack
      expect(h.printed.length).toBeGreaterThan(1);
      for (const line of h.printed) expect(line).not.toContain('測試');
      expect(testDbCloses).toBe(1);
    });

    it('a database error\'s fields that hold no row data are printed, and a cause one level deep (task 36 fix 1)', async () => {
      const unique = Object.assign(new Error('duplicate key value violates unique constraint "tours_pkey"'), {
        name: 'error', code: '23505', table: 'tours', constraint: 'tours_pkey', detail: 'Key (code)=(測試之旅) already exists.',
      });
      const h = harness(site(goodTours(2)), {
        makeDb: async () => ({ ...testDb, query: async () => { throw new Error('the save failed', { cause: unique }); } }),
      });
      expect(await runCli(['--operator', 'jetour'], DATABASE, h.deps)).toBe(1);
      expect(h.printed.slice(0, 2)).toEqual([
        'jetour: the run stopped on an unexpected error: Error: the save failed',
        '  cause: error (code 23505, table tours, constraint tours_pkey): duplicate key value violates unique constraint "tours_pkey"',
      ]);
      expect(h.printed.slice(2).every(line => line.startsWith('    at '))).toBe(true);
      for (const line of h.printed) expect(line).not.toContain('測試');
    });

    it('the default fetcher is made with the run\'s log view: whole text in a dry run, hidden in a real run', async () => {
      // No request is made: a text that is not an http(s) address is refused by the fetcher before any network use.
      const asking: OperatorScraper = {
        id: 'jetour', allowedHosts: ['shop.invalid'], parse: () => null,
        discover: async fetcher => { await fetcher.fetchText('測試之旅'); return []; },
      };
      const dry = harness(new Map(), { scrapers: { jetour: asking } });
      delete dry.deps.makeFetcher;
      await runCli(['--operator', 'jetour', '--dry-run'], IDENTITY, dry.deps);
      expect(dry.printed).toContain(`not an http(s) URL: 測試之旅 ${logRef('測試之旅')}`);

      const real = harness(new Map(), { scrapers: { jetour: asking } });
      delete real.deps.makeFetcher;
      await runCli(['--operator', 'jetour'], DATABASE, real.deps);
      expect(real.printed).toContain(`not an http(s) URL: * ${logRef('測試之旅')}`);
    });

    it('a dry run that stops on an unexpected error throws it as before (its output is not public)', async () => {
      const h = harness(site(goodTours(2)), {
        makeDryRunDb: async () => ({ ...testDb, query: async () => { throw new Error('boom'); } }),
      });
      await expect(runCli(['--operator', 'jetour', '--dry-run'], IDENTITY, h.deps)).rejects.toThrow('boom');
    });
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
    expect(Object.keys(SCRAPERS).sort()).toEqual(['bigline', 'charming', 'egl', 'jetour', 'sunflower', 'taste', 'texpert', 'yummy']);
    for (const [id, scraper] of Object.entries(SCRAPERS)) expect(scraper.id).toBe(id);
  });

  it('gives each operator a floor for runs with no history, about a third of the tours seen with dates on sale', () => {
    expect(SCRAPERS.jetour?.minExpectedTours).toBe(35);
    expect(SCRAPERS.texpert?.minExpectedTours).toBe(40);
    expect(SCRAPERS.egl?.minExpectedTours).toBe(165);
    expect(SCRAPERS.bigline?.minExpectedTours).toBe(169); // a third of the 507 tours its measured crawl would have saved
    expect(SCRAPERS.charming?.minExpectedTours).toBe(51);
    expect(SCRAPERS.yummy?.minExpectedTours).toBe(104); // a third of the 312 tours its practice crawl would have saved
    expect(SCRAPERS.sunflower?.minExpectedTours).toBe(116); // a third of the 350 tours its measured crawl would save (task 34)
    expect(SCRAPERS.taste?.minExpectedTours).toBe(93); // a third of the 279 tours its practice crawl would save (task 48)
  });

  it('only Big Line declares extra request headers, and only its one approved header for its API host', () => {
    for (const [id, scraper] of Object.entries(SCRAPERS)) {
      expect(scraper.requestHeaders, id).toEqual(id === 'bigline' ? { 'api.biglinehk.com': { tenantCode: 'DH' } } : undefined);
    }
  });

  it('the nightly workflow scrapes every registered operator, except those awaiting their measured crawl', async () => {
    /** Registered, but added to the nightly matrix only after a measured crawl has set its first-run floor. */
    const awaitingMeasuredCrawl: string[] = [];
    const entries = matrixEntries(jobOf(await nightlyWorkflow(), 'scrape'));
    expect(entries.map(entry => entry.operator).sort())
      .toEqual(Object.keys(SCRAPERS).filter(id => !awaitingMeasuredCrawl.includes(id)).sort());
  });

  it('each nightly crawl job has its own time limit: Big Line 210 minutes (its runs took 142 to 164), the others 170', async () => {
    const scrape = jobOf(await nightlyWorkflow(), 'scrape');
    expect(Object.fromEntries(matrixEntries(scrape).map(entry => [entry.operator, entry.minutes])))
      .toEqual(Object.fromEntries(Object.keys(SCRAPERS).map(id => [id, id === 'bigline' ? 210 : 170])));
    expect(scrape.match(/^ {4}timeout-minutes:.*$/gm)).toEqual(['    timeout-minutes: ${{ matrix.minutes }}']);
    // The job keeps its name in the Actions tab, `scrape (bigline)`, rather than `scrape (bigline, 210)`.
    expect(scrape).toMatch(/^ {4}name: scrape \(\$\{\{ matrix\.operator \}\}\)$/m);
    expect(scrape).toMatch(/^ {6}- run: pnpm scrape --operator \$\{\{ matrix\.operator \}\}$/m);
  });

  it('after the crawl, the workflow asks once for every stored page of the site, in each language', async () => {
    const refresh = jobOf(await nightlyWorkflow(), 'refresh');
    const paths = /^ {10}for path in ([^;]+); do$/m.exec(refresh)?.[1].trim().split(/ +/);
    expect(paths).toEqual(['/', '/zh-hans', '/en', '/tours', '/zh-hans/tours', '/en/tours', '/operators', '/zh-hans/operators', '/en/operators']);
    // The stored pages are the route files with a `revalidate`: all of them, and only them, are asked for.
    const app = new URL('../../../apps/web/app/', import.meta.url);
    const stored: string[] = [];
    for (const file of await readdir(app, { recursive: true })) {
      if (!/(^|\/)page\.tsx$/.test(file)) continue;
      const source = await readFile(new URL(file, app), 'utf8');
      if (!/^export const revalidate = 3600;$/m.test(source)) continue;
      stored.push(`/${file.split('/').filter(part => !/^\(.*\)$/.test(part) && part !== 'page.tsx').join('/')}`);
    }
    expect(stored.sort()).toEqual([...paths!].sort());
  });

  it('the refresh prints only status codes, sends no secret, and a failed or slow request never fails the workflow', async () => {
    const refresh = jobOf(await nightlyWorkflow(), 'refresh');
    expect([...refresh.matchAll(/\$\{\{([^}]*)\}\}/g)].map(match => match[1].trim())).toEqual(['!cancelled()', 'secrets.SITE_URL']);
    expect(refresh).toMatch(/^ {10}\[ -n "\$SITE_URL" \] \|\| \{ echo "SITE_URL not set: skipped"; exit 0; \}$/m);
    expect(refresh).toContain(`code=$(curl -s -o /dev/null -m 60 -w '%{http_code}' "$SITE_URL$path" || true)`);
    expect([...refresh.matchAll(/^.*\b(?:echo|printf|cat|tee)\b.*$/gm)].map(match => match[0].trim()))
      .toEqual(['[ -n "$SITE_URL" ] || { echo "SITE_URL not set: skipped"; exit 0; }', 'echo "$path $code"']);
    expect(refresh.match(/curl/g)).toHaveLength(1);
    // Nine requests of at most 60 seconds each fit well inside the job's limit, so the job is never killed by it.
    const minutes = Number(/^ {4}timeout-minutes: (\d+)$/m.exec(refresh)?.[1]);
    expect(9 * 60).toBeLessThan((minutes - 2) * 60);
  });

  it('the nightly schedule is on, once a day at 12:17 UTC (early on purpose: GitHub starts it hours late), off the hour', async () => {
    const workflow = await readFile(new URL('../../../.github/workflows/nightly-scrape.yml', import.meta.url), 'utf8');
    expect(workflow).toMatch(/^ {2}schedule:\s*$/m);
    const crons = [...workflow.matchAll(/^\s*-\s*cron:\s*'([^']*)'/gm)].map(match => match[1]);
    expect(crons).toEqual(['17 12 * * *']);
    expect(workflow).not.toMatch(/^\s*#\s*-\s*cron:/m);
  });
});

/**
 * What can be checked of a workflow file without GitHub or a YAML library: no tabs, indentation in steps of two, no
 * key given twice in one mapping, every quote, bracket and `${{ … }}` closed on its line, no plain value that YAML
 * would read as something else (`!`, `&`, `*` at its start; `: ` inside it), and each expression made only of
 * known contexts, known functions, operators and literals. Lines inside a block scalar (`run: |`) are shell, not
 * YAML, and are skipped except for their expressions. Returns the problems, each with its line number.
 */
function workflowProblems(text: string): string[] {
  const problems: string[] = [];
  const CONTEXTS = new Set(['github', 'env', 'vars', 'job', 'jobs', 'steps', 'runner', 'secrets', 'strategy', 'matrix', 'needs', 'inputs']);
  const FUNCTIONS = new Set(['contains', 'startsWith', 'endsWith', 'format', 'join', 'toJSON', 'fromJSON', 'hashFiles',
    'success', 'always', 'cancelled', 'failure']);
  const expressionProblem = (expression: string): string | null => {
    let depth = 0;
    const tokens = expression.match(/'(?:[^']|'')*'|\d+(?:\.\d+)?|[A-Za-z_][\w-]*(?:\.[A-Za-z_*][\w-]*)*|==|!=|<=|>=|&&|\|\||[!()<>,]|\S/g) ?? [];
    for (const [i, token] of tokens.entries()) {
      if (token === '(') depth++;
      else if (token === ')') { if (--depth < 0) return 'a ) with no ('; }
      else if (/^[A-Za-z_]/.test(token)) {
        const root = token.split('.')[0];
        if (tokens[i + 1] === '(') { if (!FUNCTIONS.has(token)) return `unknown function ${token}`; }
        else if (!['true', 'false', 'null'].includes(token) && !CONTEXTS.has(root)) return `unknown context ${root}`;
      } else if (!/^(?:'.*'|\d.*|==|!=|<=|>=|&&|\|\||[!<>,])$/s.test(token)) return `unexpected ${token}`;
    }
    return depth === 0 ? null : 'a ( with no )';
  };
  const stack: { indent: number; keys: Set<string> }[] = [];
  let blockAt: number | null = null;
  text.split('\n').forEach((line, i) => {
    const at = `line ${i + 1}`;
    if (line.includes('\t')) problems.push(`${at}: a tab`);
    for (const piece of line.split('${{').slice(1)) {
      const end = piece.indexOf('}}');
      if (end === -1) { problems.push(`${at}: \${{ not closed`); continue; }
      const why = expressionProblem(piece.slice(0, end));
      if (why !== null) problems.push(`${at}: ${why}`);
    }
    if (line.trim() === '' || /^ *\t/.test(line)) return;
    const indent = line.length - line.trimStart().length;
    if (blockAt !== null) {
      if (indent > blockAt) return;
      blockAt = null;
    }
    if (line.trimStart().startsWith('#')) return;
    if (indent % 2 !== 0) problems.push(`${at}: indented by an odd number of spaces`);
    let rest = line.slice(indent);
    let keyIndent = indent;
    if (rest === '-' || rest.startsWith('- ')) {
      keyIndent = indent + 2;
      rest = rest.slice(2);
      while (stack.length > 0 && stack[stack.length - 1].indent >= keyIndent) stack.pop();
      stack.push({ indent: keyIndent, keys: new Set() });
    }
    const key = /^([A-Za-z_][\w-]*):(?: +|$)(.*)$/.exec(rest);
    const value = (key ? key[2] : rest).replace(/(^| )#.*$/, '').trim();
    if (key) {
      while (stack.length > 0 && stack[stack.length - 1].indent > keyIndent) stack.pop();
      if (stack.length === 0 || stack[stack.length - 1].indent < keyIndent) stack.push({ indent: keyIndent, keys: new Set() });
      const keys = stack[stack.length - 1].keys;
      if (keys.has(key[1])) problems.push(`${at}: ${key[1]} given twice`);
      keys.add(key[1]);
      if (/^[|>][-+]?$/.test(value)) { blockAt = keyIndent; return; }
    }
    if (value === '') return;
    if (/^[!&*@`%]/.test(value)) problems.push(`${at}: a plain value may not start with ${value[0]}`);
    else if (value.startsWith("'")) { if (!/^'(?:[^']|'')*'$/.test(value)) problems.push(`${at}: a quote not closed`); }
    else if (value.startsWith('"')) { if (!/^"(?:[^"\\]|\\.)*"$/.test(value)) problems.push(`${at}: a quote not closed`); }
    else if (value.startsWith('[') || value.startsWith('{')) {
      const outside = value.replace(/\$\{\{.*?\}\}/g, 'x').replace(/'(?:[^']|'')*'/g, 'x');
      const opened = (outside.match(/[[{]/g) ?? []).length;
      if (opened !== (outside.match(/[\]}]/g) ?? []).length || !/[\]}]$/.test(outside)) problems.push(`${at}: a bracket not closed`);
    } else if (/: /.test(value.replace(/\$\{\{.*?\}\}/g, 'x'))) problems.push(`${at}: ": " inside a plain value`);
  });
  return problems;
}

describe('the workflow files', () => {
  const dir = new URL('../../../.github/workflows/', import.meta.url);

  it('finds the faults it looks for (the check itself)', () => {
    const bad = (yaml: string) => workflowProblems(yaml);
    expect(bad('jobs:\n  a:\n    if: ${{ !cancelled() }}\n    run: |\n      echo "a: b" # odd:  indent\n')).toEqual([]);
    expect(bad('a:\n\tb: 1')).toEqual(['line 2: a tab']);
    expect(bad('a:\n   b: 1')).toEqual(['line 2: indented by an odd number of spaces']);
    expect(bad('a:\n  b: 1\n  c: 2\n  b: 3')).toEqual(['line 4: b given twice']);
    expect(bad('a:\n  - b: 1\n    c: 2\n  - b: 3\n    c: 4')).toEqual([]);
    expect(bad('a:\n  - b: 1\n    b: 2')).toEqual(['line 3: b given twice']);
    expect(bad('if: !cancelled()')).toEqual(['line 1: a plain value may not start with !']);
    expect(bad('run: echo a: b')).toEqual(['line 1: ": " inside a plain value']);
    expect(bad("cron: '17 12 * * *")).toEqual(['line 1: a quote not closed']);
    expect(bad('operator: [egl, jetour')).toEqual(['line 1: a bracket not closed']);
    expect(bad('- { operator: egl, minutes: 170 }')).toEqual([]);
    expect(bad('t: ${{ matrix.minutes }')).toEqual(['line 1: ${{ not closed']);
    expect(bad('t: ${{ matrx.minutes }}')).toEqual(['line 1: unknown context matrx']);
    expect(bad('t: ${{ !canceled() }}')).toEqual(['line 1: unknown function canceled']);
    expect(bad('t: ${{ (success() }}')).toEqual(['line 1: a ( with no )']);
    expect(bad("t: ${{ matrix.operator == 'bigline' && 210 || 170 }}")).toEqual([]);
  });

  it.each(['ci.yml', 'check-settings.yml', 'nightly-scrape.yml'])('%s has none of those faults', async name => {
    expect(workflowProblems(await readFile(new URL(name, dir), 'utf8'))).toEqual([]);
  });

  it('are the three checked above', async () => {
    expect((await readdir(dir)).sort()).toEqual(['check-settings.yml', 'ci.yml', 'nightly-scrape.yml']);
  });

  it('the nightly workflow uses only its own secrets, only the matrix keys it defines, and needs only earlier jobs', async () => {
    const workflow = await nightlyWorkflow();
    expect([...new Set([...workflow.matchAll(/\bsecrets\.([A-Za-z_]+)/g)].map(match => match[1]))].sort())
      .toEqual(['CONTACT_EMAIL', 'DATABASE_CA_CERT', 'DATABASE_URL', 'SITE_URL']);
    const scrape = jobOf(workflow, 'scrape');
    expect([...new Set([...scrape.matchAll(/\bmatrix\.([A-Za-z_]+)/g)].map(match => match[1]))].sort()).toEqual(['minutes', 'operator']);
    expect(workflow.replace(scrape, '')).not.toMatch(/\bmatrix\./);
    const jobs = [...workflow.slice(workflow.indexOf('\njobs:\n')).matchAll(/^ {2}([a-z][\w-]*):$/gm)].map(match => match[1]);
    expect(jobs).toEqual(['migrate', 'scrape', 'refresh']);
    const needs = needsOf(workflow);
    expect(needs).toEqual({ migrate: [], scrape: ['migrate'], refresh: ['scrape'] });
    for (const [i, job] of jobs.entries()) for (const need of needs[job]) expect(jobs.slice(0, i), job).toContain(need);
    for (const job of jobs) expect(jobOf(workflow, job), job).toMatch(/^ {4}timeout-minutes: (?:\d+|\$\{\{ matrix\.minutes \}\})$/m);
    expect([...workflow.matchAll(/^([a-z][\w-]*):/gm)].map(match => match[1])).toEqual(['name', 'on', 'permissions', 'concurrency', 'jobs']);
  });

  it.each(['ci.yml', 'check-settings.yml', 'nightly-scrape.yml'])(
    '%s sets secrets only in a step\'s env, reads nothing more than contents, pins its actions and prints no secret',
    async name => {
      expect(safetyProblems(await readFile(new URL(name, dir), 'utf8'), { nightly: name === 'nightly-scrape.yml' })).toEqual([]);
    },
  );

  it('the nightly workflow sets each secret in the steps that need it', async () => {
    const lines = yamlLines(await nightlyWorkflow()).filter(line => /\bsecrets\./.test(line.value));
    expect(lines.map(line => `${line.path[1]}: ${line.key}`)).toEqual([
      'migrate: DATABASE_URL', 'migrate: DATABASE_CA_CERT', 'migrate: SITE_URL', 'migrate: CONTACT_EMAIL',
      'scrape: DATABASE_URL', 'scrape: DATABASE_CA_CERT', 'scrape: SITE_URL', 'scrape: CONTACT_EMAIL',
      'refresh: SITE_URL',
    ]);
  });

  describe('the safety checks themselves, on the nightly workflow changed in memory', () => {
    /** The nightly workflow with the `nth` (from 1) occurrence of `from` replaced; throws when there is none. */
    const changed = async (from: string, to: string, nth = 1) => {
      const text = await nightlyWorkflow();
      let at = -1;
      for (let i = 0; i < nth; i++) {
        at = text.indexOf(from, at + 1);
        if (at === -1) throw new Error(`not found: ${from}`);
      }
      return text.slice(0, at) + to + text.slice(at + from.length);
    };
    const LIMIT = '    timeout-minutes: ${{ matrix.minutes }}\n';
    const PERSIST = '        with:\n          persist-credentials: false\n';
    const IDENTITY_ECHO = '          echo "CONTACT_EMAIL set:';
    const INSTALL = '      - run: pnpm install --frozen-lockfile\n';
    const CHECKOUT = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';

    it.each<[string, string, string, number?]>([
      ['a secret at job level', LIMIT, `${LIMIT}    env:\n      DATABASE_URL: \${{ secrets.DATABASE_URL }}\n`],
      ['a secret at workflow level', 'permissions:\n', 'env:\n  DATABASE_URL: ${{ secrets.DATABASE_URL }}\n\npermissions:\n'],
      ['a secret moved to the job', LIMIT, `${LIMIT}    env:\n      CONTACT_EMAIL: \${{ secrets.CONTACT_EMAIL }}\n`],
      ['a secret in a step\'s with', PERSIST, `${PERSIST}          token: \${{ secrets.SITE_URL }}\n`],
      ['a secret in a command', INSTALL, `${INSTALL}      - run: echo \${{ secrets.SITE_URL }}\n`],
      ['fail-fast removed', '      fail-fast: false # one operator failing must not stop the others\n', ''],
      ['fail-fast true', 'fail-fast: false', 'fail-fast: true'],
      ['persist-credentials removed from the scrape checkout', PERSIST, '', 2],
      ['persist-credentials true', 'persist-credentials: false', 'persist-credentials: true'],
      ['permissions to write', '  contents: read\n', '  contents: write\n'],
      ['permissions widened at job level', LIMIT, `${LIMIT}    permissions:\n      contents: write\n`],
      ['cancel-in-progress true', 'cancel-in-progress: false', 'cancel-in-progress: true'],
      ['a secret echoed', IDENTITY_ECHO, `          echo "$DATABASE_URL"\n${IDENTITY_ECHO}`],
      ['a secret printed with printf', IDENTITY_ECHO, `          printf '%s' "\${CONTACT_EMAIL}"\n${IDENTITY_ECHO}`],
      ['a bare env step', INSTALL, `${INSTALL}      - run: env\n`],
      ['a printenv step', INSTALL, `${INSTALL}      - run: printenv DATABASE_URL\n`],
      ['a bare set in a script', IDENTITY_ECHO, `          set\n${IDENTITY_ECHO}`],
      ['tracing turned on', IDENTITY_ECHO, `          set -ex\n${IDENTITY_ECHO}`],
      ['an action by tag', CHECKOUT, 'actions/checkout@v7'],
      ['an action by a short hash', CHECKOUT, 'actions/checkout@3d3c42e'],
    ])('%s is found', async (_name, from, to, nth) => {
      expect(safetyProblems(await changed(from, to, nth), { nightly: true })).not.toEqual([]);
    });

    it.each<[string, string, string]>([
      ['needs as a list', '    needs: migrate\n', '    needs: [migrate]\n'],
      ['needs as a block list', '    needs: migrate\n', '    needs:\n      - migrate\n'],
      ['a block-style matrix entry', '          - { operator: egl, minutes: 170 }\n', '          - operator: egl\n            minutes: 170\n'],
      ['a comment after a matrix entry', '          - { operator: taste, minutes: 170 }\n', '          - { operator: taste, minutes: 170 } # since task 48\n'],
      ['set -euo pipefail', IDENTITY_ECHO, `          set -euo pipefail\n${IDENTITY_ECHO}`],
    ])('%s passes', async (_name, from, to) => {
      const text = await changed(from, to);
      expect(workflowProblems(text)).toEqual([]);
      expect(safetyProblems(text, { nightly: true })).toEqual([]);
      expect(needsOf(text)).toEqual(needsOf(await nightlyWorkflow()));
      expect(matrixEntries(jobOf(text, 'scrape'))).toEqual(matrixEntries(jobOf(await nightlyWorkflow(), 'scrape')));
    });

    it.each([
      '          - { operator: egl, minutes: 170, extra: 1 }\n',
      '          - { operator: egl, operator: jetour, minutes: 170 }\n',
      '          - { operator: egl }\n',
      '          - operator: egl\n',
      '          - { operator: egl, minutes: soon }\n',
      '          - egl\n',
    ])('a matrix entry %j is not one', async to => {
      const text = await changed('          - { operator: egl, minutes: 170 }\n', to);
      expect(() => matrixEntries(jobOf(text, 'scrape'))).toThrow();
    });
  });
});
