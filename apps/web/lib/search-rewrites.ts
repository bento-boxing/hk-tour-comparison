import { LOCALES } from './i18n';
import { localeHref } from './locale-path';
import { SEARCH_QUERY_NAMES } from './search-params';

// A search page served as a stored copy (the home page, in each language) reads no query string: the copy is the page
// without filters. Each such page has a second, per-request copy of itself at an internal address under '/q' (the
// home page's is app/(zh-hant)/q/page.tsx, app/zh-hans/q/page.tsx, app/en/q/page.tsx), which reads the query string
// as the page always did. The routing rules below send an address of the page that carries any name the search pages
// read (SEARCH_QUERY_NAMES) to that copy: '/?dmin=5' is answered by '/q?dmin=5'. A rewrite, not a redirect: the
// visitor's address bar keeps '/?dmin=5', and Next.js's client navigation (a filter's router.push) follows the same
// rules. An address with only other names ('/?utm_source=x') gets the stored copy.
//
// The rules are `beforeFiles` rewrites (next.config.ts): Next.js checks those before it looks for a page at the
// address. The default kind (`afterFiles`) is checked only when no page answers the address, and '/' always has one
// (the stored copy), so those rules would never apply (measured under `next start`, task 59).
//
// The internal address is never linked. A visit typed or followed straight to it is sent back to the page's own
// address (a temporary redirect, as routing rules: no page code runs), robots.txt disallows it, and its canonical is
// the page's own address in any case (lib/site-metadata.ts). Redirects are applied to the address the visitor asked
// for, before any rewrite, so the rewritten requests above never meet them.
//
// The destination and operator pages ('/tours/:id', '/operators/:id') can follow later by adding their paths to
// STORED_SEARCH_PAGES and their per-request copies under '/q' (app/(zh-hant)/q/tours/[id]/page.tsx…).

/** The search pages served as stored copies, each with a per-request copy for its filtered addresses (paths without a language). */
export const STORED_SEARCH_PAGES = ['/'] as const;

/** The first segment, after the language, of every per-request copy's internal address. */
export const PER_REQUEST_SEGMENT = 'q';

/** The internal address of a stored page's per-request copy, without a language: '/' → '/q', '/tours/:id' → '/q/tours/:id'. */
export function perRequestPath(path: string): string {
  return path === '/' ? `/${PER_REQUEST_SEGMENT}` : `/${PER_REQUEST_SEGMENT}${path}`;
}

/** A routing rule, in the shape next.config.ts's rewrites() takes. */
export interface QueryRewrite { source: string; has: [{ type: 'query'; key: string }]; destination: string }

/** A routing rule, in the shape next.config.ts's redirects() takes. */
export interface PathRedirect { source: string; destination: string; permanent: false }

/**
 * One rule for each language, stored page and name in SEARCH_QUERY_NAMES: the page's address carrying that name (with
 * any value but an empty one: Next.js does not match `?dmin=`, which the page reads as no filter anyway) is answered
 * by its per-request copy, the query string passed on unchanged.
 */
export function storedSearchRewrites(): QueryRewrite[] {
  return LOCALES.flatMap(locale => STORED_SEARCH_PAGES.flatMap(path => SEARCH_QUERY_NAMES.map(key => ({
    source: localeHref(locale, path),
    has: [{ type: 'query', key }] as [{ type: 'query'; key: string }],
    destination: localeHref(locale, perRequestPath(path)),
  }))));
}

/**
 * A visit straight to a per-request copy's internal address goes to the page's own address, query string kept (which
 * the rules above then send back to the copy, unseen). Temporary (307), so no browser or search engine keeps it.
 */
export function perRequestRedirects(): PathRedirect[] {
  return LOCALES.flatMap(locale => STORED_SEARCH_PAGES.map(path => ({
    source: localeHref(locale, perRequestPath(path)),
    destination: localeHref(locale, path),
    permanent: false as const,
  })));
}

/** The internal addresses' beginnings in each language ('/q', '/zh-hans/q', '/en/q'), for robots.txt to disallow. */
export function perRequestPrefixes(): string[] {
  return LOCALES.map(locale => localeHref(locale, `/${PER_REQUEST_SEGMENT}`));
}
