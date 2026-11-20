import { it, expect } from 'vitest';
import {
  languageAlternates, localeFromSegment, localeHref, siteUrl, splitLocalePath,
} from './locale-path';

it.each([
  ['zh-hans', 'zh-Hans'],
  ['en', 'en'],
  // Only the exact spellings: no second address for a language, and no guessing.
  ['zh-hant', null],
  ['zh-Hans', null],
  ['EN', null],
  ['En', null],
  ['fr', null],
  ['', null],
  ['chain', null],
  ['tours', null],
  ['constructor', null],
  ['toString', null],
] as const)('localeFromSegment(%j) → %j', (segment, locale) => {
  expect(localeFromSegment(segment)).toBe(locale);
});

it.each([
  ['zh-Hant', '/', '/'],
  ['zh-Hant', '/chain', '/chain'],
  ['zh-Hant', '/?dmin=5&page=2', '/?dmin=5&page=2'],
  ['zh-Hant', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3'],
  ['zh-Hans', '/', '/zh-hans'],
  ['zh-Hans', '/chain', '/zh-hans/chain'],
  ['zh-Hans', '/?sort=days', '/zh-hans?sort=days'],
  ['en', '/', '/en'],
  ['en', '/chain', '/en/chain'],
  ['en', '/tours/japan?dmin=5&size=48', '/en/tours/japan?dmin=5&size=48'],
  ['en', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3', '/en/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3'],
  ['en', '/#top', '/en#top'],
  ['en', '/tours/japan-kansai', '/en/tours/japan-kansai'], // part 2's pages work the same way
] as const)('localeHref(%s, %j) → %j (never a trailing slash)', (locale, path, href) => {
  expect(localeHref(locale, path)).toBe(href);
});

it.each(['', 'chain', 'https://example.test/', '//example.test/x', '?dmin=5'])('refuses %j: only a site path starting with one / can get a language', path => {
  expect(() => localeHref('en', path)).toThrow();
});

it.each([
  ['/', 'zh-Hant', '/'],
  ['/chain', 'zh-Hant', '/chain'],
  ['/zh-hans', 'zh-Hans', '/'],
  ['/zh-hans/chain', 'zh-Hans', '/chain'],
  ['/en', 'en', '/'],
  ['/en/', 'en', '/'],
  ['/en/chain', 'en', '/chain'],
  // Next.js redirects a trailing slash away before a page sees it, but the helper does not rely on that.
  ['/en/chain/', 'en', '/chain'],
  ['/zh-hans/tours/japan/', 'zh-Hans', '/tours/japan'],
  ['/en/tours/japan', 'en', '/tours/japan'],
  // Not a language prefix: the path is left whole (these addresses are 404s anyway).
  ['/english', 'zh-Hant', '/english'],
  ['/EN/chain', 'zh-Hant', '/EN/chain'],
  ['/zh-hant/chain', 'zh-Hant', '/zh-hant/chain'],
] as const)('splitLocalePath(%j) → %s and %j', (pathname, locale, path) => {
  expect(splitLocalePath(pathname)).toEqual({ locale, path });
});

it('splitLocalePath undoes localeHref for every language and page', () => {
  for (const locale of ['zh-Hant', 'zh-Hans', 'en'] as const) {
    for (const path of ['/', '/chain', '/tours/japan']) expect(splitLocalePath(localeHref(locale, path))).toEqual({ locale, path });
  }
});

it('siteUrl: the absolute address, the home page without a trailing slash (as Next.js writes the canonical)', () => {
  expect(siteUrl('/')).toBe('https://example.invalid');
  expect(siteUrl('/chain')).toBe('https://example.invalid/chain');
  expect(siteUrl('/en')).toBe('https://example.invalid/en');
});

it.each([
  ['/', {
    'zh-Hant': 'https://example.invalid',
    'zh-Hans': 'https://example.invalid/zh-hans',
    en: 'https://example.invalid/en',
    'x-default': 'https://example.invalid',
  }],
  ['/chain', {
    'zh-Hant': 'https://example.invalid/chain',
    'zh-Hans': 'https://example.invalid/zh-hans/chain',
    en: 'https://example.invalid/en/chain',
    'x-default': 'https://example.invalid/chain',
  }],
] as const)('languageAlternates(%j): the page in each language and x-default (the unprefixed one), absolute', (path, expected) => {
  expect(languageAlternates(path)).toEqual(expected);
  expect(Object.keys(languageAlternates(path))).toEqual(['zh-Hant', 'zh-Hans', 'en', 'x-default']);
});
