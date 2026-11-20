import { it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// No text on the site may break inside a word (task 47): text wraps only where a line may break anyway, between
// words (and in Chinese, between characters). This test walks every stylesheet under apps/web and fails on any
// declaration that lets the browser break a word: overflow-wrap / word-wrap (break-word, anywhere), word-break
// (break-all, break-word) and hyphens. It cannot see layout: that a long word still fits its box is measured in a
// browser.

// Not new URL(…, import.meta.url): under jsdom, URL is jsdom's and rejects the file scheme.
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'out', 'coverage']);

function stylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : stylesheets(join(dir, entry.name));
    return entry.name.endsWith('.css') ? [join(dir, entry.name)] : [];
  });
}

it('no stylesheet lets a word break: no overflow-wrap, word-wrap, word-break or hyphens', () => {
  const files = stylesheets(WEB);
  expect(files.length).toBeGreaterThan(20);
  const found = files.flatMap(file => {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    return [...css.matchAll(/(overflow-wrap|word-wrap|word-break|hyphens)\s*:\s*([^;}]+)/g)]
      .map(m => `${relative(WEB, file)}: ${m[1]}: ${m[2].trim()}`);
  });
  expect(found).toEqual([]);
});
