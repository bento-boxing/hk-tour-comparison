import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import GlobalNotFound, { metadata } from './global-not-found';
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import { prepareDestination } from 'next/dist/shared/lib/router/utils/prepare-destination';
import { getRedirectStatus, modifyRouteRegex } from 'next/dist/lib/redirect-status';
import nextConfig from '../next.config';

const page = () => new DOMParser().parseFromString(renderToStaticMarkup(<GlobalNotFound />), 'text/html');

it('says the page was not found in all three languages, each marked with its language, guessing none', () => {
  const doc = page();
  expect(doc.documentElement.getAttribute('lang')).toBe('zh-Hant-HK');
  const sections = [...doc.querySelectorAll('main section')];
  expect(sections.map(s => s.getAttribute('lang'))).toEqual(['zh-Hant-HK', 'zh-Hans', 'en']);
  expect(sections.map(s => s.querySelector('h1, h2')?.textContent)).toEqual(['找不到這一頁', '找不到这一页', 'Page not found']);
  expect(doc.querySelectorAll('h1')).toHaveLength(1);
});

it('links only to the search page in each language, marked with hreflang', () => {
  const links = [...page().querySelectorAll('a')];
  expect(links.map(a => [a.getAttribute('href'), a.getAttribute('hreflang'), a.textContent])).toEqual([
    ['/', 'zh-Hant', '搜尋旅行團'],
    ['/zh-hans', 'zh-Hans', '搜索旅行团'],
    ['/en', 'en', 'Find tours'],
  ]);
});

it('is titled in Traditional Chinese with the site name; Next.js adds the noindex itself', () => {
  expect(metadata).toEqual({ title: '找不到這一頁 | 跟邊團' });
});

it('uses the theme tokens only, and the mark in the nav bar\'s colouring', () => {
  const css = readFileSync(join(__dirname, 'global-not-found.module.css'), 'utf8').replace(/\s+/g, ' ');
  expect(css).toMatch(/\.bar \{[^}]*background: var\(--bar-bg\); color: var\(--bar-text\)/);
  expect(css).toMatch(/\.mark \{[^}]*--mark-primary: var\(--bar-text\); --mark-accent: var\(--bar-accent\)/);
  expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
});

/**
 * Where the server sends a request, by next.config's redirects, using Next.js's own steps (the matcher and
 * destination code its router uses for config redirects): '308 /chain?x=1', or null when no redirect applies.
 */
async function redirected(address: string): Promise<string | null> {
  const url = new URL(address, 'http://localhost');
  const query = Object.fromEntries(url.searchParams);
  for (const route of (await nextConfig.redirects?.()) ?? []) {
    const params = getPathMatch(route.source, {
      strict: true, removeUnnamedParams: true, regexModifier: regex => modifyRouteRegex(regex, ['/_next']),
    })(url.pathname);
    if (!params) continue;
    const { parsedDestination } = prepareDestination({ appendParamsToQuery: false, destination: route.destination, params, query });
    const search = new URLSearchParams(parsedDestination.query as Record<string, string>).toString();
    return `${getRedirectStatus(route)} ${parsedDestination.pathname}${search ? `?${search}` : ''}`;
  }
  return null;
}

it('next.config switches the 404 page on', () => {
  expect(nextConfig.experimental?.globalNotFound).toBe(true);
});

it.each([
  ['/zh-hant', '308 /'],
  ['/zh-hant?dest=japan&page=2', '308 /?dest=japan&page=2'],
  ['/zh-hant/chain?x=1', '308 /chain?x=1'],
  ['/zh-hant/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3', '308 /chain?legs=egl%3AKIX5%402026-12-18&gap=1-3'],
  ['/zh-hant/tours/japan', '308 /tours/japan'], // part 2's pages, too
  // Next.js matches redirect sources whatever their case.
  ['/zh-Hant/chain', '308 /chain'],
])('%s is a permanent redirect to the same address without /zh-hant, query kept: %s', async (address, expected) => {
  expect(await redirected(address)).toBe(expected);
});

it.each(['/', '/chain', '/zh-hans', '/zh-hans/chain', '/en', '/en/chain', '/zh-hantx', '/en/zh-hant', '/_next/zh-hant'])('%s is not redirected', async address => {
  expect(await redirected(address)).toBeNull();
});
