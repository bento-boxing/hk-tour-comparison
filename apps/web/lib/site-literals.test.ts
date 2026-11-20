import { it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The live site's address and contact are settings (SITE_URL and CONTACT_EMAIL, since 2026-11-20), not code: the
// repository is public, and a copy run unchanged must not crawl operators' sites in this site's name. Code reads
// them through core's resolveSiteIdentity (the website: lib/site-identity.ts; the scraper: its CLI), and tests
// use invented example.invalid values. This test walks every code file of every package and app, tests
// included, and the workflows, and fails on any that holds the live site's domain. Documents (README.md, docs/)
// are not code and may name it: they are meant to be read. The domain is taken from README.md's first line, so
// that this test does not hold it either.

// Not new URL(…, import.meta.url): under jsdom, URL is jsdom's and rejects the file scheme.
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** Installed packages, build output (Next.js, `vercel build`, tsc, others) and git's own files: not our code. */
const SKIP_DIRS = new Set(['node_modules', '.next', '.vercel', '.turbo', '.git', 'dist', 'out', 'coverage']);

/** Every code, data and workflow file under `dir`: only directories are walked and only regular files read. */
function codeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : codeFiles(path);
    if (!entry.isFile()) return [];
    return /\.(ts|tsx|mts|cts|js|mjs|cjs|json|ya?ml)$/.test(entry.name) ? [path] : [];
  });
}

/** The live site's domain without its last label ('example' for example.org), from README.md's first line. */
function liveDomainName(): string {
  const readme = readFileSync(join(REPO, 'README.md'), 'utf8');
  const address = /^A website \(<https:\/\/([a-z0-9.-]+)>\)/m.exec(readme);
  expect(address, 'README.md\'s first line names the site\'s address').not.toBeNull();
  const labels = address![1].split('.');
  expect(labels.length).toBeGreaterThan(1);
  return labels.at(-2)!;
}

it('no code or test file holds the live site\'s domain: the address and contact are settings', () => {
  const name = liveDomainName();
  expect(name.length).toBeGreaterThan(5); // long enough that a match is the domain, not a common word
  const files = ['packages', 'apps', '.github'].flatMap(top => codeFiles(join(REPO, top)));
  expect(files.length).toBeGreaterThan(200); // the walk did reach the code
  expect(files.some(path => path.endsWith(join('lib', 'site-literals.test.ts')))).toBe(true); // tests included, this one too
  const holding = files
    .filter(path => readFileSync(path, 'utf8').toLowerCase().includes(name))
    .map(path => relative(REPO, path).split(sep).join('/'));
  expect(holding).toEqual([]);
});
