import { it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The site's domain (address and contact) is written once, in packages/core/src/site.ts, and imported everywhere
// else: the website's metadata, robots.txt, sitemap and footer, and the scraper's User-Agent. This test walks the
// code of every package and app (not *.test.ts(x) files, which may spell it out) and fails on a second copy; a
// shared test helper or setup file must import the constants. Documents (README.md, docs/) are not code and are
// not checked: the README quotes the User-Agent and gives the contact address.

// Not new URL(…, import.meta.url): under jsdom, URL is jsdom's and rejects the file scheme.
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** Installed packages, build output (Next.js, `vercel build`, others) and git's own files: not our code. */
const SKIP_DIRS = new Set(['node_modules', '.next', '.vercel', '.turbo', '.git', 'dist', 'out', 'coverage']);

/** Every code file under `dir`: only directories are walked and only regular files read (a stray .DS_Store is neither). */
function codeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : codeFiles(path);
    if (!entry.isFile()) return [];
    return /\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

it('the domain is written in one place in code (core/src/site.ts); everything else imports it', () => {
  const files = ['packages', 'apps'].flatMap(top => codeFiles(join(REPO, top)));
  expect(files.length).toBeGreaterThan(100); // the walk did reach the code
  const writing = files
    .filter(path => readFileSync(path, 'utf8').includes('ganbintuen'))
    .map(path => relative(REPO, path).split(sep).join('/'));
  expect(writing).toEqual(['packages/core/src/site.ts']);
});
