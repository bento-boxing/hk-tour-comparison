// @vitest-environment node
import { it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PHASE_PRODUCTION_SERVER } from 'next/constants';
// Next.js's own check of next.config.ts's routing rules (the one `next build` runs). An internal module: if this import
// breaks after a Next.js upgrade, delete that test; a build still checks the rules.
import { checkCustomRoutes } from 'next/dist/lib/load-custom-routes';
import { SEARCH_QUERY_NAMES } from './search-params';
import {
  PER_REQUEST_SEGMENT, STORED_SEARCH_PAGES, perRequestPath, perRequestPrefixes, perRequestRedirects, storedSearchRewrites,
} from './search-rewrites';

const HOMES = ['/', '/zh-hans', '/en'];
const INTERNAL = { '/': '/q', '/zh-hans': '/zh-hans/q', '/en': '/en/q' } as Record<string, string>;

it('the home page is the one stored search page so far, and its per-request copy is at /q in each language', () => {
  expect(STORED_SEARCH_PAGES).toEqual(['/']);
  expect(PER_REQUEST_SEGMENT).toBe('q');
  expect(perRequestPath('/')).toBe('/q');
  // The destination and operator pages would follow the same pattern.
  expect(perRequestPath('/tours/:id')).toBe('/q/tours/:id');
});

it('each home page address carrying any name the search pages read goes to its per-request copy: one rule per language and name, made from the list', () => {
  const rules = storedSearchRewrites();
  expect(rules).toHaveLength(HOMES.length * SEARCH_QUERY_NAMES.length);
  for (const home of HOMES) {
    const own = rules.filter(rule => rule.source === home);
    // Every name in the list, each once, and nothing else.
    expect(own.map(rule => rule.has[0].key)).toEqual([...SEARCH_QUERY_NAMES]);
    for (const rule of own) {
      expect(rule.destination).toBe(INTERNAL[home]);
      // A name alone (any value): no value pattern, and no query string written into the destination.
      expect(rule.has).toEqual([{ type: 'query', key: rule.has[0].key }]);
    }
  }
  // No rule for a name the pages do not read, such as a campaign tag: those addresses get the stored copy.
  expect(rules.some(rule => rule.has[0].key.startsWith('utm_'))).toBe(false);
});

it('a visit straight to an internal address goes to the page\'s own address, temporarily; robots.txt is given the internal addresses', () => {
  expect(perRequestRedirects()).toEqual(HOMES.map(home => ({ source: INTERNAL[home], destination: home, permanent: false })));
  expect(perRequestPrefixes()).toEqual(['/q', '/zh-hans/q', '/en/q']);
});

it('Next.js accepts the rules as they are (the check `next build` makes)', () => {
  expect(() => checkCustomRoutes(storedSearchRewrites(), 'rewrite')).not.toThrow();
  expect(() => checkCustomRoutes(perRequestRedirects(), 'redirect')).not.toThrow();
});

it('next.config.ts applies the rules before Next.js looks for a page (beforeFiles), and the redirects after its own', async () => {
  const { default: config } = await import('../next.config');
  const settings = config(PHASE_PRODUCTION_SERVER);
  const rewrites = await settings.rewrites!();
  expect(rewrites).toEqual({ beforeFiles: storedSearchRewrites(), afterFiles: [], fallback: [] });
  const redirects = await settings.redirects!();
  expect(redirects).toEqual(expect.arrayContaining(perRequestRedirects()));
});

it('each internal address has its page in each language (the per-request copy), and each stored page its own', () => {
  const app = join(__dirname, '..', 'app');
  for (const root of ['(zh-hant)', 'zh-hans', 'en']) {
    expect(existsSync(join(app, root, 'page.tsx')), root).toBe(true);
    expect(existsSync(join(app, root, PER_REQUEST_SEGMENT, 'page.tsx')), root).toBe(true);
  }
});
