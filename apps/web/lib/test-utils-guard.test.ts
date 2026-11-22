import { expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Helpers for tests only are named *.test-utils.* (lib/render-at-document.test-utils.tsx registers a vitest afterEach
// when imported). This reads every source file under apps/web (node_modules, .next and other generated folders aside)
// and fails if one that is not a test, nor such a helper, imports one. It reads text: an import through a variable
// (import(name)) is not seen.

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.next', 'coverage', 'out']);

function sourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) found.push(relative(WEB, path).split(sep).join('/'));
    }
  };
  walk(WEB);
  return found.sort();
}

/** A test, a test-only helper, or the test runner's own setup. */
const isTestOnly = (path: string) =>
  /\.(test|spec|test-utils)\.[cm]?[jt]sx?$/.test(path) || path === 'vitest.setup.ts' || path === 'vitest.config.ts';
/** The modules a file names in import … from, export … from, a bare import, import(…) or require(…). */
const imported = (text: string) =>
  [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm)].map(m => m[1]);
const namesHelper = (module: string) => /\.test-utils(\.[cm]?[jt]sx?)?$/.test(module);

it('the test-only helpers exist and tests import them', () => {
  expect(sourceFiles()).toContain('lib/render-at-document.test-utils.tsx');
  const users = sourceFiles().filter(path => imported(readFileSync(join(WEB, path), 'utf8')).some(namesHelper));
  expect(users.length).toBeGreaterThan(0);
  expect(users.every(isTestOnly)).toBe(true);
});

it('no file of the site imports a test-only helper', () => {
  const wrong = sourceFiles()
    .filter(path => !isTestOnly(path))
    .filter(path => imported(readFileSync(join(WEB, path), 'utf8')).some(namesHelper));
  expect(wrong).toEqual([]);
});

it('catches the forms it means to', () => {
  expect(imported("import { renderAtDocument } from '../lib/render-at-document.test-utils';")).toEqual(['../lib/render-at-document.test-utils']);
  expect(imported("export * from './x.test-utils';\nconst m = await import('./y.test-utils');\nrequire(\"./z.test-utils\");\nimport './w.test-utils';"))
    .toEqual(['./x.test-utils', './y.test-utils', './z.test-utils', './w.test-utils']);
  expect(isTestOnly('components/TourCard.test.tsx')).toBe(true);
  expect(isTestOnly('lib/render-at-document.test-utils.tsx')).toBe(true);
  expect(isTestOnly('components/TourCard.tsx')).toBe(false);
  expect(namesHelper('../lib/render-at-document.test-utils')).toBe(true);
  expect(namesHelper('../lib/render-at-document')).toBe(false);
});
