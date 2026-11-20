import { it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The live site's address and contact are settings (SITE_URL and CONTACT_EMAIL, since 2026-11-20), not code: the
// repository is public, and a copy run unchanged must not crawl operators' sites in this site's name. Code reads
// them through core's resolveSiteIdentity (the website: lib/site-identity.ts; the scraper: its CLI), and tests
// use invented example.invalid values. This test reads every text file under packages/, apps/ and .github/
// (code, tests, fixtures, styles, SQL, scripts, images written as text, workflows; not build output or installed
// packages, and not binary files) and fails on any that holds the live site's domain. Documents (README.md,
// docs/) are outside those folders and may name it: they are meant to be read. The domain is taken from
// README.md's first line, so that this test does not hold it either.

// Not new URL(…, import.meta.url): under jsdom, URL is jsdom's and rejects the file scheme.
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** Installed packages, build output (Next.js, `vercel build`, tsc, others) and git's own files: not our code. */
const SKIP_DIRS = new Set(['node_modules', '.next', '.vercel', '.turbo', '.git', 'dist', 'out', 'coverage']);

/** Every regular file under `dir`, whatever its type, outside SKIP_DIRS: only directories are walked. */
function allFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : allFiles(path);
    return entry.isFile() ? [path] : [];
  });
}

/** A file's text, or null for a binary file (one holding a NUL byte, as git decides: an image, a font). */
function text(path: string): string | null {
  const bytes = readFileSync(path);
  return bytes.includes(0) ? null : bytes.toString('utf8');
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

it('no text file under packages/, apps/ or .github/ holds the live site\'s domain: the address and contact are settings', () => {
  const name = liveDomainName();
  expect(name.length).toBeGreaterThan(5); // long enough that a match is the domain, not a common word
  const files = ['packages', 'apps', '.github'].flatMap(top => allFiles(join(REPO, top)));
  const texts = files.flatMap(path => {
    const content = text(path);
    return content === null ? [] : [{ path: relative(REPO, path).split(sep).join('/'), content }];
  });
  expect(texts.length).toBeGreaterThan(390); // the walk did reach the code (about 400 text files in git, 2026-11-20)
  // Every kind of text file is read, not only code: this test itself, a stylesheet, a page fixture, SQL, a
  // script, the SVG icon and the workflows.
  for (const kind of [/lib\/site-literals\.test\.ts$/, /\.css$/, /\.html$/, /\.sql$/, /\.py$/, /\.svg$/, /^\.github\/workflows\/.*\.yml$/]) {
    expect(texts.some(({ path }) => kind.test(path)), String(kind)).toBe(true);
  }
  const holding = texts.filter(({ content }) => content.toLowerCase().includes(name)).map(({ path }) => path);
  expect(holding).toEqual([]);
});
