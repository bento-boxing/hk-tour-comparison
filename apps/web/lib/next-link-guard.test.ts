import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Every internal link goes through components/SiteLink.tsx, which does not pre-load the page it links to unless the
// link says so (task 55: the pages are made per request, and each pre-load is a server render). This test reads the
// source of every .ts, .tsx, .js, .mjs and .jsx file under apps/web (tests included; node_modules, .next and other
// generated folders aside, and this file, whose examples are the code it catches), comments removed, and fails on:
//   1. next/link imported anywhere but components/SiteLink.tsx (import … from, import(…), require(…), export … from);
//   2. router.prefetch(…), which would pre-load by hand.
// vi.mock('next/link', …) in a test is not an import and is allowed. How strong it is: it reads text; it does not
// catch an import through a variable (import(name)), or a page pre-loaded some other way.

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.next', 'coverage', 'out', 'next-env.d.ts']);
const WRAPPER = 'components/SiteLink.tsx';
/** This file: its examples below are written as the code they catch. */
const SELF = 'lib/next-link-guard.test.ts';

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

const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/** Everything wrong with one file's code (`path` is from apps/web). */
export function problems(path: string, text: string): string[] {
  const src = code(text);
  const found: string[] = [];
  const nextLink = String.raw`['"]next/link(?:\.js)?['"]`;
  const imports = new RegExp([String.raw`\bfrom\s*${nextLink}`, String.raw`\bimport\s*${nextLink}`,
    String.raw`\bimport\s*\(\s*${nextLink}`, String.raw`\brequire\s*\(\s*${nextLink}`].join('|'), 'g');
  if (path !== WRAPPER) for (const m of src.matchAll(imports)) found.push(`${path}: ${m[0]} (use SiteLink from components/SiteLink.tsx)`);
  for (const m of src.matchAll(/\.prefetch\s*\(/g)) found.push(`${path}: ${m[0]}`);
  return found;
}

it('only components/SiteLink.tsx imports next/link, and nothing pre-loads a page by hand', () => {
  const files = sourceFiles();
  // The walk sees the files that make links, so an empty or wrong walk cannot pass.
  for (const path of [WRAPPER, 'components/NavBar.tsx', 'components/Pager.tsx', 'components/Footer.tsx', 'app/_site/search-band.tsx',
    'app/_site/tours-page.tsx', 'next.config.ts', 'components/NavBar.test.tsx']) {
    expect(files, path).toContain(path);
  }
  expect(files.some(path => path.startsWith('node_modules/') || path.startsWith('.next/'))).toBe(false);
  expect(files).toContain(SELF);
  expect(files.filter(path => path !== SELF).flatMap(path => problems(path, readFileSync(join(WEB, path), 'utf8')))).toEqual([]);
  // The wrapper itself does import it (a stale wrapper path would make rule 1 meaningless).
  expect(readFileSync(join(WEB, WRAPPER), 'utf8')).toMatch(/import Link from 'next\/link';/);
});

describe('it catches', () => {
  it.each([
    "import Link from 'next/link';",
    'import Link from "next/link";',
    "import NextLink, { useLinkStatus } from 'next/link';",
    "import { useLinkStatus } from 'next/link';",
    "import type { LinkProps } from 'next/link';",
    "import Link from 'next/link.js';",
    "export { default } from 'next/link';",
    "const Link = (await import('next/link')).default;",
    "const Link = require('next/link');",
    "import 'next/link';",
    'router.prefetch(localeHref(t.locale, \'/tours\'));',
    'useRouter().prefetch(href);',
  ])('in a component: %s', line => {
    expect(problems('components/X.tsx', line)).not.toEqual([]);
  });

  it.each([
    "vi.mock('next/link', () => ({ default: () => null }));",
    '// a comment about next/link',
    "import { SiteLink } from '../components/SiteLink';",
    '<SiteLink href={localeHref(t.locale, \'/\')}>x</SiteLink>',
  ])('and lets pass: %s', line => {
    expect(problems('components/X.tsx', line)).toEqual([]);
  });

  it('and lets the wrapper import it', () => {
    expect(problems(WRAPPER, "import Link from 'next/link';")).toEqual([]);
  });
});
