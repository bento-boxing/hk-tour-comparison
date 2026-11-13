/**
 * `pnpm scrape --operator <id> [--dry-run] [--limit N]`: one operator's nightly run.
 * Needs DATABASE_URL unless --dry-run. Exit codes: 0 ok, 1 the run failed its checks,
 * 2 bad usage or missing configuration.
 */
import { pathToFileURL } from 'node:url';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { OPERATOR_IDS, places, todayInHongKong, type OperatorId } from '@hktours/core';
import { createPgDb, type Db } from '@hktours/db';
import { createDryRunDb, latestRunSummary } from './dry-run-db';
import { describePage, formatUnmatched, recordDryRun, unmatchedCounts } from './dry-run-report';
import { SCRAPERS } from './operators';
import { createFetcher } from './polite-fetch';
import { runOperator } from './run-operator';
import type { Fetcher, OperatorScraper } from './types';

export interface CliArgs { operator: OperatorId; dryRun: boolean; limit: number | null }

type Env = Record<string, string | undefined>;

export interface CliDeps {
  scrapers: Partial<Record<OperatorId, OperatorScraper>>;
  /** Called once per process: every request of the run goes through this one fetcher. */
  makeFetcher: () => Fetcher;
  makeDb: (databaseUrl: string) => Promise<Db>;
  makeDryRunDb: () => Promise<Db>;
  print: (line: string) => void;
  now: () => Date;
  /** Routes every later fetch() through the proxy the environment names. */
  installProxy: (env: Env) => void;
}

const USAGE = 'usage: pnpm scrape --operator <id> [--dry-run] [--limit N]\n'
  + `  <id> is one of ${OPERATOR_IDS.join(', ')}. --limit N (a whole number from 1) is allowed only with --dry-run.`;

const isOperatorId = (value: string): value is OperatorId => (OPERATOR_IDS as readonly string[]).includes(value);

export function parseArgs(argv: string[]): CliArgs | { error: string } {
  let operator: string | undefined;
  let dryRun = false;
  let limit: number | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue; // pnpm may pass one through
    if (arg === '--dry-run') {
      if (dryRun) return { error: '--dry-run is given twice' };
      dryRun = true;
      continue;
    }
    if (arg !== '--operator' && arg !== '--limit') return { error: `unknown argument ${arg}` };
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) return { error: `${arg} needs a value` };
    if (arg === '--operator') {
      if (operator !== undefined) return { error: '--operator is given twice' };
      operator = value;
    } else {
      if (limit !== null) return { error: '--limit is given twice' };
      if (!/^[1-9][0-9]*$/.test(value)) return { error: `--limit must be a whole number from 1, not ${value}` };
      limit = Number(value);
    }
  }

  if (operator === undefined) return { error: '--operator is required' };
  if (!isOperatorId(operator)) return { error: `unknown operator ${operator}` };
  // A limited real run would deactivate every tour it did not reach.
  if (limit !== null && !dryRun) return { error: '--limit is allowed only with --dry-run' };
  return { operator, dryRun, limit };
}

/** True when the environment names a proxy for HTTP or HTTPS. */
export function proxyWanted(env: Env): boolean {
  return ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy'].some(name => Boolean(env[name]));
}

/**
 * Node's built-in fetch ignores the proxy variables; undici's EnvHttpProxyAgent honours them
 * (lower-case names first, as undici reads them) and NO_PROXY. createFetcher is unchanged, so
 * the User-Agent, robots.txt and spacing still apply to every request.
 */
function installEnvProxy(env: Env): void {
  const pick = (name: string) => env[name.toLowerCase()] || env[name] || undefined;
  setGlobalDispatcher(new EnvHttpProxyAgent({
    httpProxy: pick('HTTP_PROXY'), httpsProxy: pick('HTTPS_PROXY'), noProxy: pick('NO_PROXY'),
  }));
}

/** Returns the process exit code: 0 ok, 1 run failed its checks, 2 bad usage or missing configuration. */
export async function runCli(argv: string[], env: Env, deps: Partial<CliDeps> = {}): Promise<number> {
  const print = deps.print ?? (line => console.log(line));
  const {
    scrapers = SCRAPERS,
    makeFetcher = () => createFetcher({ log: print }),
    makeDb = async (url: string) => createPgDb(url),
    makeDryRunDb = createDryRunDb,
    now = () => new Date(),
    installProxy = installEnvProxy,
  } = deps;

  const args = parseArgs(argv);
  if ('error' in args) {
    print(args.error);
    print(USAGE);
    return 2;
  }
  const scraper = scrapers[args.operator];
  if (scraper === undefined) {
    print(`no scraper is registered for ${args.operator}; registered: ${Object.keys(scrapers).join(', ') || 'none'}`);
    return 2;
  }
  const databaseUrl = env.DATABASE_URL;
  if (!args.dryRun && !databaseUrl) {
    print('DATABASE_URL is not set: a real run needs it (or pass --dry-run)');
    return 2;
  }

  if (proxyWanted(env)) installProxy(env);
  const fetcher = makeFetcher();
  const today = todayInHongKong(now());

  if (!args.dryRun) {
    const db = await makeDb(databaseUrl!);
    try {
      const outcome = await runOperator(scraper, { db, fetcher, index: places, today, now, log: print });
      return outcome.ok ? 0 : 1;
    } finally {
      await db.close();
    }
  }

  print(`dry run of ${args.operator}: nothing is written to the database`);
  const recorder = recordDryRun(scraper, args.limit);
  const db = await makeDryRunDb();
  try {
    const outcome = await runOperator(recorder.scraper, { db, fetcher, index: places, today, now, log: print });
    const pages = recorder.pages.map(page => describePage(page, places, today));
    for (const page of pages) print(`page ${JSON.stringify(page)}`);

    const summary = await latestRunSummary(db, scraper.id);
    const fetched = summary?.pagesFetched ?? 0;
    const failures = summary?.parseFailures ?? 0;
    const rate = fetched === 0 ? '' : ` (${((failures / fetched) * 100).toFixed(1)}% of ${fetched} tour pages fetched)`;
    const discovered = recorder.discovered();
    const unmatched = unmatchedCounts(pages);

    print(`dry-run summary: ${args.operator}, ${today}`);
    print(`tour pages discovered: ${discovered ?? 0}${
      args.limit !== null && discovered !== null && discovered > args.limit ? ` (limited to the first ${args.limit})` : ''}`);
    print(`tour pages fetched: ${fetched}`);
    print(`tours saved: ${summary?.toursSaved ?? 0}`);
    print(`parse failures: ${failures}${rate}`);
    print(`run checks: ${outcome.ok ? 'ok' : `failed (${outcome.reasons.join(', ')})`}`);
    print(`unmatched names: ${unmatched.length} (pages each appeared on, most frequent first)`);
    for (const line of formatUnmatched(unmatched)) print(line);
    return outcome.ok ? 0 : 1;
  } finally {
    await db.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli(process.argv.slice(2), process.env);
}
