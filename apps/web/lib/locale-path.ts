import { SITE_URL } from '@hktours/core';
import type { Locale } from './i18n';

// The language is part of the address, and nothing else decides it: Traditional Chinese has no prefix ('/',
// '/chain'), Simplified Chinese is '/zh-hans/…' and English '/en/…', in lower case, with no trailing slash.
// These spellings are permanent once search engines have indexed them.
//
// localeHref is the one place a language and a path become an address. Every internal link and navigation
// goes through it (a test checks the source: lib/locale-links.test.ts); nothing else adds a language prefix.

/** The first segment of each language's addresses; null for Traditional Chinese, which has none. */
export const LOCALE_SEGMENT = { 'zh-Hant': null, 'zh-Hans': 'zh-hans', en: 'en' } as const satisfies Record<Locale, string | null>;

type PrefixedLocale = 'zh-Hans' | 'en';

const BY_SEGMENT: ReadonlyMap<string, PrefixedLocale> = new Map([['zh-hans', 'zh-Hans'], ['en', 'en']]);

/**
 * The language a first segment names, exactly as spelled above; null for anything else ('zh-hant', 'EN',
 * 'zh-Hans', 'fr'), which is not a language prefix (no page answers there: app/ has only the folders
 * zh-hans and en besides the unprefixed pages).
 */
export function localeFromSegment(segment: string): PrefixedLocale | null {
  return BY_SEGMENT.get(segment) ?? null;
}

/**
 * The address of `path` in `locale`. `path` is a site path without a language: it starts with a single '/'
 * and may carry a query string or a #fragment ('/', '/chain?legs=…'). The home page in another language has
 * no trailing slash: ('en', '/?dest=japan') → '/en?dest=japan'.
 */
export function localeHref(locale: Locale, path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error(`localeHref: not a site path: ${JSON.stringify(path)}`);
  const segment = LOCALE_SEGMENT[locale];
  if (segment === null) return path;
  const home = path === '/' || path[1] === '?' || path[1] === '#';
  return home ? `/${segment}${path.slice(1)}` : `/${segment}${path}`;
}

/**
 * The language of a path the browser shows (usePathname) and the same path without it: '/en/chain' →
 * en and '/chain'; '/chain' → zh-Hant and '/chain'. The inverse of localeHref.
 */
export function splitLocalePath(pathname: string): { locale: Locale; path: string } {
  const match = /^\/([^/]+)(\/.*)?$/.exec(pathname);
  const locale = match ? localeFromSegment(match[1]) : null;
  if (!match || locale === null) return { locale: 'zh-Hant', path: pathname };
  const rest = match[2] ?? '/';
  return { locale, path: rest === '/' ? '/' : rest.replace(/\/$/, '') };
}

/** The absolute address of a site address; the home page without a trailing slash, as Next.js writes the canonical. */
export function siteUrl(href: string): string {
  return href === '/' ? SITE_URL : `${SITE_URL}${href}`;
}

/** The hreflang name of each language (BCP 47, script subtags for the two Chinese scripts). */
export const HREFLANG: Record<Locale, string> = { 'zh-Hant': 'zh-Hant', 'zh-Hans': 'zh-Hans', en: 'en' };

/**
 * One page's address in each language, absolute, keyed by hreflang, plus x-default: the unprefixed
 * (Traditional Chinese) address, for a reader whose language is none of the three.
 */
export function languageAlternates(path: string): Record<'zh-Hant' | 'zh-Hans' | 'en' | 'x-default', string> {
  return {
    'zh-Hant': siteUrl(localeHref('zh-Hant', path)),
    'zh-Hans': siteUrl(localeHref('zh-Hans', path)),
    en: siteUrl(localeHref('en', path)),
    'x-default': siteUrl(localeHref('zh-Hant', path)),
  };
}
