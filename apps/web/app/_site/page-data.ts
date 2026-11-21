import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { todayInHongKong, type IsoDate, type OperatorId } from '@hktours/core';
import type { DestinationCounts, OperatorListing } from '@hktours/db/read';
import type { Locale } from '../../lib/i18n';
import { requestDb } from '../../lib/db';
import { cachedReads, loadSearchPage, type SearchPageData } from '../../lib/search-page-data';
import { loadChainPage, type ChainPageData } from '../../lib/chain-page-data';
import { loadSavedPage, type SavedPageData } from '../../lib/saved-page-data';
import { shownOperators } from '../../lib/operators';

// Each page's database load, made once per request: the page renders from it, and its metadata marks the page
// noindex when it failed (or, for a destination, when it has no tours). React's cache (the way the Next.js docs give
// for sharing data between generateMetadata and the page) hands the second caller the first one's promise, so a
// request reads the database at most once per load, and an unreachable database is tried once, not twice.
// The keys are plain values (the language, the path's destination id, the query string), because React's cache
// compares its arguments by identity.

export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * A page's database load: the data, or nothing when the database could not be read (the reason is logged). `now` is
 * when it was made (ISO): the rows compare their operator's last good run with it (an old-data warning), and the
 * server and the browser must compare with the same time.
 */
export type Loaded<T> = { ok: true; today: IsoDate; now: string; data: T } | { ok: false; today: IsoDate; now: string };

/** An address's query parameters as one query string, in their order, repeats kept: a value React's cache can key on. */
export function queryOf(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : [value]) if (typeof v === 'string') query.append(name, v);
  }
  return query.toString();
}

/** The parameters of a query string, as Next.js gives them to a page: a repeated name as a list. */
export function paramsOf(query: string): SearchParams {
  const params: SearchParams = {};
  for (const [name, value] of new URLSearchParams(query)) {
    const before = params[name];
    params[name] = before === undefined ? value : [...(Array.isArray(before) ? before : [before]), value];
  }
  return params;
}

/**
 * Runs `load`. A missing DATABASE_URL or an unreachable database becomes { ok: false } (the visitor gets a short
 * message, the log gets the cause); Next.js's own signals (such as "render this per request") pass through.
 */
async function attempt<T>(page: string, today: IsoDate, load: () => Promise<T>): Promise<Loaded<T>> {
  const now = new Date().toISOString();
  try {
    return { ok: true, today, now, data: await load() };
  } catch (err) {
    unstable_rethrow(err);
    console.error(`${page}: could not load tours:`, err);
    return { ok: false, today, now };
  }
}

/**
 * The search page's data: on '/' (destinationId null; a `dest` in the query is ignored, see movedSearchHref) or on
 * a destination's page, whose id (from the path, already checked by the caller) is the destination.
 */
export const loadSearch = cache(async (locale: Locale, destinationId: string | null, query: string): Promise<Loaded<SearchPageData>> => {
  const today = todayInHongKong();
  const { dest: _ignored, ...rest } = paramsOf(query);
  const raw = destinationId === null ? rest : { ...rest, dest: destinationId };
  return attempt('search page', today, async () => loadSearchPage(await requestDb(), raw, today, locale, cachedReads));
});

/** The chaining page's data (its `dest` stays in the query: the chain page has no destination pages). */
export const loadChain = cache(async (locale: Locale, query: string): Promise<Loaded<ChainPageData>> => {
  const today = todayInHongKong();
  return attempt('chain page', today, async () => loadChainPage(await requestDb(), paramsOf(query), today, locale, cachedReads));
});

/** The saved page's data: the tours its address lists (`t`); with none, no database read at all. */
export const loadSaved = cache(async (query: string): Promise<Loaded<SavedPageData>> => {
  const today = todayInHongKong();
  return attempt('saved page', today, async () => loadSavedPage(requestDb, paramsOf(query), today, cachedReads));
});

/** How many tours each destination has now: the destinations index's data. */
export const loadCounts = cache(async (): Promise<Loaded<DestinationCounts>> => {
  const today = todayInHongKong();
  return attempt('destinations index', today, async () => cachedReads.countToursByDestination(await requestDb(), today));
});

/** An operator's page's data: the operator's own listing, and its tours as the search page reads them. */
export interface OperatorPageData {
  /**
   * The operator: names, colour, home address, last good run and listed tours; undefined when the site does not list
   * it (not in the database, or never had a good run: lib/operators.ts), and the page is then a 404.
   */
  listing: OperatorListing | undefined;
  /** Its tours; null when there is nothing to search: no listing, or no tours listed now. */
  search: SearchPageData | null;
}

/**
 * An operator's page's data: first the operator's listing (one cached read shared with the index and the sitemap);
 * then, only for an operator the site lists that has tours now, the search page's data with the operator fixed by
 * the path (its id already checked by the caller). An `op` in the query is ignored, so no address can show another
 * operator's tours here; every other filter (the destination among them, as `dest`) is read as on the search page.
 */
export const loadOperator = cache(async (locale: Locale, operatorId: OperatorId, query: string): Promise<Loaded<OperatorPageData>> => {
  const today = todayInHongKong();
  const { op: _ignored, ...rest } = paramsOf(query);
  return attempt('operator page', today, async () => {
    const db = await requestDb();
    const listing = shownOperators(await cachedReads.getOperatorListings(db, today)).find(o => o.id === operatorId);
    if (!listing || listing.tours === 0) return { listing, search: null };
    return { listing, search: await loadSearchPage(db, { ...rest, op: operatorId }, today, locale, cachedReads) };
  });
});

/** Every operator the site lists, with its tours now: the operators index's data. */
export const loadOperatorListings = cache(async (): Promise<Loaded<OperatorListing[]>> => {
  const today = todayInHongKong();
  return attempt('operators index', today, async () => shownOperators(await cachedReads.getOperatorListings(await requestDb(), today)));
});
