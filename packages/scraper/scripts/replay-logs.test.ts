import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * `pnpm replay` runs this script in packages/scraper (pnpm's doing), while the paths it is given were typed wherever
 * the command was typed (INIT_CWD). Run as pnpm runs it: in the package directory, with INIT_CWD elsewhere.
 */
const PACKAGE = resolve(import.meta.dirname, '..');
let typedIn: string;

function replay(...args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'scripts/replay-logs.ts', ...args], {
    cwd: PACKAGE, env: { ...process.env, INIT_CWD: typedIn }, encoding: 'utf8',
  });
}

beforeEach(() => {
  typedIn = mkdtempSync(join(tmpdir(), 'replay-typed-'));
  mkdirSync(join(typedIn, 'logs/jetour'), { recursive: true });
  const page = { url: 'https://example.test/tour/T1', code: 'T1', result: 'ok', dayHeadings: ['香港 → 大阪', '大阪 → 京都'], days: 2 };
  writeFileSync(join(typedIn, 'logs/jetour/dry-run-1.log'), `dry run of jetour\npage ${JSON.stringify(page)}\n`);
});
afterEach(() => rmSync(typedIn, { recursive: true, force: true }));

describe('pnpm replay', () => {
  it('reads --logs, writes --save and reads --before where the command was typed, not in the package', () => {
    const saved = replay('--logs', 'logs', '--save', 'before.json');
    expect(saved.stderr).toBe('');
    expect(saved.status).toBe(0);
    expect(saved.stdout).toContain(join(typedIn, 'logs/jetour/dry-run-1.log'));
    expect(existsSync(join(typedIn, 'before.json'))).toBe(true);
    expect(existsSync(join(PACKAGE, 'before.json'))).toBe(false);

    const compared = replay('--logs', 'logs', '--before', 'before.json');
    expect(compared.stderr).toBe('');
    expect(compared.status).toBe(0);
    expect(compared.stdout).toContain('0 tours changed route');
  }, 30_000);

  it('fails, rather than look like a replay with no changes, when no logs are found', () => {
    const missing = replay('--logs', 'no-such-folder');
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain(`no saved crawl logs`);
    expect(missing.stderr).toContain(join(typedIn, 'no-such-folder'));
  }, 30_000);
});
