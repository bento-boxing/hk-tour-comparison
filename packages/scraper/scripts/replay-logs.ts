/**
 * Replays the saved crawl logs through normaliseTour, offline, to see what a change to places or rules does to
 * real operator text before it ships (see src/replay.ts for what is read).
 *
 *   pnpm replay                       counts per operator with the working tree's core
 *   pnpm replay --base <commit>       the same, and every tour whose route differs from that commit's core
 *   pnpm replay --save <file>         also writes this replay, for a later --before
 *   pnpm replay --before <file>       compares with a replay saved earlier instead of a commit
 *   --logs <dir>                      where the logs are (default .superpowers/raw-pages, git-ignored)
 *
 * For each operator directory the newest `dry-run-<n>.log` or `dry-run-<YYYY-MM-DD>.log` is read (newestLogName: a
 * dated log is newer than any numbered one). Nothing is fetched. A page whose log gives no days
 * (logged, stated in the fallback text or in the code) is given one per day heading, counted per operator and marked
 * in the changed-route list: the too-far rule depends on the days. --base copies that commit's
 * packages/core with `git archive` into a temporary directory and loads it from there.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as head from '@hktours/core';
import { changedRoutes, countsOf, logPages, newestLogName, replayPage, type ReplayCore, type ReplayedPage } from '../src/replay';

const REPO = resolve(import.meta.dirname, '../../..');
const USAGE = 'usage: pnpm replay [--base <commit> | --before <file>] [--save <file>] [--logs <dir>]';
type Replay = Record<string, ReplayedPage[]>;

function option(args: string[], name: string): string | undefined {
  const at = args.indexOf(name);
  if (at === -1) return undefined;
  const value = args[at + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value\n${USAGE}`);
  return value;
}

/** Operator id → the text of its newest dry-run log. */
function newestLogs(dir: string): Map<string, { file: string; text: string }> {
  const logs = new Map<string, { file: string; text: string }>();
  if (!existsSync(dir)) return logs;
  for (const operator of readdirSync(dir).sort()) {
    if (!existsSync(join(dir, operator)) || !/^[a-z]+$/.test(operator)) continue;
    const newest = newestLogName(readdirSync(join(dir, operator)));
    if (newest === undefined) continue;
    const file = join(dir, operator, newest);
    logs.set(operator, { file, text: readFileSync(file, 'utf8') });
  }
  return logs;
}

/** The core of an earlier commit, copied out of git (packages/core only) and loaded with the repository's zod. */
async function coreAt(commit: string): Promise<{ core: ReplayCore; cleanUp: () => void }> {
  if (!/^[\w./~^-]+$/.test(commit)) throw new Error(`not a commit: ${commit}`);
  const dir = mkdtempSync(join(tmpdir(), 'replay-core-'));
  const tarball = execFileSync('git', ['archive', '--format=tar', commit, 'packages/core'], { cwd: REPO, maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', dir], { input: tarball });
  symlinkSync(join(REPO, 'packages/core/node_modules'), join(dir, 'packages/core/node_modules'));
  const core = (await import(pathToFileURL(join(dir, 'packages/core/src/index.ts')).href)) as ReplayCore;
  return { core, cleanUp: () => rmSync(dir, { recursive: true, force: true }) };
}

function replay(logs: Map<string, { text: string }>, core: ReplayCore): Replay {
  return Object.fromEntries([...logs].map(([operator, { text }]) => [operator, logPages(text).map(page => replayPage(operator, page, core))]));
}

const percent = (share: number) => `${(share * 100).toFixed(1)}%`;
const routeText = (route: string[]) => (route.length === 0 ? 'no stops' : route.map(key => {
  const place = key.startsWith('region:') ? head.places.region(key.slice(7)) : head.places.city(key);
  return place?.nameZh ?? key;
}).join(' → '));

function printCounts(label: string, result: Replay): void {
  console.log(`${label}: saved / no-stops / no departures / parse failures of pages; pages whose days are their heading count`);
  for (const [operator, pages] of Object.entries(result)) {
    const c = countsOf(pages);
    console.log(`  ${operator}: ${c.saved} / ${c.noStops} / ${c.noDepartures} / ${c.failures} of ${c.pages} (${percent(c.failureRate)}); ${c.daysFromHeadings}`);
  }
}

async function main(args: string[]): Promise<number> {
  const logsDir = resolve(option(args, '--logs') ?? join(REPO, '.superpowers/raw-pages'));
  const base = option(args, '--base');
  const beforeFile = option(args, '--before');
  const saveFile = option(args, '--save');
  if (base !== undefined && beforeFile !== undefined) throw new Error(`--base and --before do not go together\n${USAGE}`);

  const logs = newestLogs(logsDir);
  if (logs.size === 0) {
    console.log(`no saved crawl logs (<operator>/dry-run-<n>.log or dry-run-<YYYY-MM-DD>.log) found under ${logsDir}`);
    return 0;
  }
  for (const [operator, { file }] of logs) console.log(`${operator}: ${file}`);

  const after = replay(logs, head);
  if (saveFile !== undefined) writeFileSync(saveFile, JSON.stringify(after));

  let before: Replay | undefined;
  if (beforeFile !== undefined) before = JSON.parse(readFileSync(beforeFile, 'utf8')) as Replay;
  if (base !== undefined) {
    const { core, cleanUp } = await coreAt(base);
    try {
      before = replay(logs, core);
    } finally {
      cleanUp();
    }
  }

  if (before !== undefined) printCounts('before', before);
  printCounts(before !== undefined ? 'after' : 'working tree', after);
  if (before === undefined) return 0;

  let changed = 0;
  for (const [operator, pages] of Object.entries(after)) {
    for (const change of changedRoutes(before[operator] ?? [], pages)) {
      changed++;
      const days = change.days == null ? '' : ` (${change.days} days${change.daysFrom === 'headings' ? ', from the heading count' : ''})`;
      console.log(`${operator} ${change.code ?? change.url}${days}: ${routeText(change.before)} => ${routeText(change.after)}`);
    }
  }
  console.log(`${changed} tours changed route (each page given dates on sale, so tours with none today are compared too)`);
  return 0;
}

main(process.argv.slice(2)).then(code => process.exit(code), (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
