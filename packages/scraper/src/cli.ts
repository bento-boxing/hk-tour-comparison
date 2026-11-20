/**
 * `pnpm scrape --operator <id> [--dry-run] [--limit N]`: one operator's nightly run.
 * Always needs SITE_URL and CONTACT_EMAIL (the site and contact its User-Agent names; no default), dry run or not.
 * Needs DATABASE_URL unless --dry-run; DATABASE_CA_CERT, when set, verifies the database server.
 * Exit codes: 0 ok, 1 the run failed its checks (or a real run stopped on an unexpected error), 2 bad usage or
 * missing or invalid configuration.
 */
import { pathToFileURL } from 'node:url';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import {
  OPERATOR_IDS, places, resolveSiteIdentity, SiteIdentityError, todayInHongKong, type OperatorId, type SiteIdentity,
} from '@hktours/core';
import { createPgDb, normaliseCaCert, type Db } from '@hktours/db';
import { unexpectedErrorLines } from '@hktours/db/public-error';
import { createDryRunDb, latestRunSummary } from './dry-run-db';
import { describePage, formatUnmatched, recordDryRun, unmatchedCounts } from './dry-run-report';
import { SCRAPERS } from './operators';
import { createFetcher, userAgentFor } from './polite-fetch';
import { DRY_RUN_LOG, PUBLIC_LOG, type LogView } from './public-log';
import { runOperator } from './run-operator';
import type { Fetcher, OperatorScraper, RequestHeaders } from './types';

export interface CliArgs { operator: OperatorId; dryRun: boolean; limit: number | null }

type Env = Record<string, string | undefined>;

export interface CliDeps {
  scrapers: Partial<Record<OperatorId, OperatorScraper>>;
  /**
   * Called once per process, and only once the site's identity is resolved: every request of the run goes
   * through this one fetcher. `userAgent` is userAgentFor(the identity from SITE_URL and CONTACT_EMAIL).
   * `requestHeaders` are the running operator's own (see OperatorScraper.requestHeaders), never another
   * operator's. `logView`: PUBLIC_LOG for a real run, DRY_RUN_LOG for a dry run (see public-log.ts).
   */
  makeFetcher: (userAgent: string, requestHeaders?: RequestHeaders, logView?: LogView) => Fetcher;
  /** `ca` is DATABASE_CA_CERT normalised, or undefined when it is not set. */
  makeDb: (databaseUrl: string, ca: string | undefined) => Promise<Db>;
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

/**
 * A real run's unexpected error, for its public log, by the rule shared with `pnpm db:migrate`
 * (`@hktours/db/public-error`): the error's kind, the fields that hold no row data (SQLSTATE or Node code, table,
 * column, constraint…), its message unless it may quote data (then hidden, with a reference), its cause one level
 * deep, and the stack's `at` lines. Never a database error's `detail`, which can quote the row it was given.
 */
function printUnexpected(operator: OperatorId, error: unknown, print: (line: string) => void): void {
  const [first, ...rest] = unexpectedErrorLines(error);
  print(`${operator}: the run stopped on an unexpected error: ${first}`);
  for (const line of rest) print(line);
}

/**
 * Returns the process exit code: 0 ok, 1 run failed its checks (or a real run stopped on an unexpected error),
 * 2 bad usage or missing configuration.
 */
export async function runCli(argv: string[], env: Env, deps: Partial<CliDeps> = {}): Promise<number> {
  const print = deps.print ?? (line => console.log(line));
  // Before anything else, dry run or not: who the bot says it is. Without a good SITE_URL and CONTACT_EMAIL the
  // run stops here, with one line naming the variable (never its value), before any fetcher, proxy or database
  // exists, so no request of any kind is made.
  let identity: SiteIdentity;
  try {
    identity = resolveSiteIdentity(env);
  } catch (error) {
    if (!(error instanceof SiteIdentityError)) throw error;
    print(error.message);
    return 2;
  }

  const {
    scrapers = SCRAPERS,
    makeFetcher = (userAgent: string, requestHeaders?: RequestHeaders, logView?: LogView) =>
      createFetcher({ userAgent, log: print, extraHeaders: requestHeaders, logView }),
    makeDb = async (url: string, ca: string | undefined) => createPgDb(url, { ca }),
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
  let ca: string | undefined;
  if (!args.dryRun) {
    try {
      ca = normaliseCaCert(env.DATABASE_CA_CERT);
    } catch (err) {
      print((err as Error).message); // names the variable, never its value
      return 2;
    }
  }

  if (proxyWanted(env)) installProxy(env);
  // A real run's log is public (GitHub Actions); a dry run's is not, so it prints addresses and messages whole.
  const logView = args.dryRun ? DRY_RUN_LOG : PUBLIC_LOG;
  const fetcher = makeFetcher(userAgentFor(identity), scraper.requestHeaders, logView);
  const today = todayInHongKong(now());

  if (!args.dryRun) {
    const db = await makeDb(databaseUrl!, ca);
    try {
      const outcome = await runOperator(scraper, { db, fetcher, index: places, today, now, log: print, logView });
      return outcome.ok ? 0 : 1;
    } catch (error) {
      // Left uncaught, Node would print the error whole, and a database error can quote a row it was given.
      printUnexpected(args.operator, error, print);
      return 1;
    } finally {
      await db.close();
    }
  }

  print(`dry run of ${args.operator}: nothing is written to the database`);
  const recorder = recordDryRun(scraper, args.limit);
  const db = await makeDryRunDb();
  try {
    const outcome = await runOperator(recorder.scraper, { db, fetcher, index: places, today, now, log: print, logView });
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
