import { it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextConfig } from '../next.config';

// Since task 53 the theme is the browser's alone (localStorage, lib/theme.ts): the server never reads it, so a page's
// HTML is the same for every visitor whatever theme they use, and no cookie is involved at all. This guard reads every
// source file of the website (not tests) and fails on any that reads the request's cookies or headers and has
// anything to do with the theme, that sets a cookie from the server or from next.config, or that reads or writes
// document.cookie.

// Not new URL(…, import.meta.url): under jsdom, URL is jsdom's and rejects the file scheme.
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Installed packages and build output: not our code. */
const SKIP_DIRS = new Set(['node_modules', '.next', '.vercel', '.turbo', 'dist', 'out', 'coverage']);

/** Every source file under `dir` (TypeScript and JavaScript), but tests. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sources(path);
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

const files = ['app', 'lib', 'components'].flatMap(d => sources(join(WEB, d)));
const text = (path: string) => readFileSync(path, 'utf8');
/**
 * Uses the request's cookies or headers (next/headers) in any form: a static import, a dynamic import(), a require(),
 * a re-export. Any mention of the module counts, so no way of loading it slips through.
 */
const readsRequest = (source: string) => /next\/headers/.test(source);

it('counts every way of loading next/headers', () => {
  for (const source of [
    "import { cookies } from 'next/headers';",
    'import * as h from "next/headers";',
    "const theme = (await (await import('next/headers')).cookies()).get('theme');",
    "const { cookies } = require('next/headers');",
    "export { cookies } from 'next/headers';",
  ]) expect(readsRequest(source), source).toBe(true);
  expect(readsRequest("import { connection } from 'next/server';")).toBe(false);
});

it('reads the files it guards', () => {
  expect(files.length).toBeGreaterThan(50);
  expect(files.map(f => relative(WEB, f))).toContain('app/_site/site-frame.tsx');
});

it('no server code reads the theme from a cookie (or anything else from the request)', () => {
  const offenders = files.filter(f => readsRequest(text(f)) && /theme/i.test(text(f)));
  expect(offenders.map(f => relative(WEB, f))).toEqual([]);
  // The old helpers are gone.
  for (const gone of ['lib/theme-server.ts', 'lib/theme-action.ts']) expect(existsSync(join(WEB, gone)), gone).toBe(false);
});

it('no server code sets a cookie, and no server action remains (the switch was the only one)', () => {
  const offenders = files.filter(f => /\.set\(\s*['"`]?\w*theme|cookies\(\)\s*\)?\s*\.set\(|^\s*['"]use server['"]/m.test(text(f)));
  expect(offenders.map(f => relative(WEB, f))).toEqual([]);
});

it('next.config sets no cookie and has no rule that depends on one (no response of the site carries Set-Cookie)', async () => {
  expect(text(join(WEB, 'next.config.ts'))).not.toMatch(/cookie/i);
  for (const route of (await nextConfig.headers?.()) ?? []) {
    expect(route.headers.map(h => h.key.toLowerCase()), route.source).not.toContain('set-cookie');
    expect([...(route.has ?? []), ...(route.missing ?? [])].map(c => c.type), route.source).not.toContain('cookie');
  }
});

it('nothing in the website reads or writes document.cookie (the theme lives in localStorage)', () => {
  const all = sources(WEB);
  expect(all.map(f => relative(WEB, f))).toEqual(expect.arrayContaining(['next.config.ts', 'lib/theme.ts', 'lib/theme-choice.ts']));
  expect(all.filter(f => /document\s*\.\s*cookie|\bcookieStore\b/.test(text(f))).map(f => relative(WEB, f))).toEqual([]);
});

/**
 * For stage 2 part 4 (serving one stored copy of each page): the files that read the request's cookies or headers.
 * None since task 53. Adding one is a choice to make knowingly: it makes every page under it depend on the request.
 */
it('no file reads the request\'s cookies or headers at all', () => {
  expect(files.filter(f => readsRequest(text(f))).map(f => relative(WEB, f))).toEqual([]);
});
