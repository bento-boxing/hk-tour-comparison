import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { todayInHongKong, type IsoDate, type OperatorId } from '@hktours/core';
import type { Db, DestinationCounts, ListedCount, OperatorListing } from '@hktours/db/read';
import type { Locale } from '../../lib/i18n';
import type { RawParams } from '../../lib/raw-params';
import { requestDb, storedDb } from '../../lib/db';
import { cachedReads, loadSearchPage, type SearchPageData } from '../../lib/search-page-data';
import { loadChainPage, type ChainPageData } from '../../lib/chain-page-data';
import { loadSavedPage, type SavedPageData } from '../../lib/saved-page-data';
import { shownOperators } from '../../lib/operators';
import { currentWindow, type SeasonId, type SeasonWindow } from '../../lib/seasons';
import { monthCounts, seasonCounts, type MonthCount, type SeasonCount } from '../../lib/season-counts';

// Each page's database load, made once per render. For the pages rendered per request, the page renders from it, and
// its metadata marks the page noindex when it failed (or, for a destination, when it has no tours); the stored pages
// have loaders of their own, below, that throw instead. React's cache (the way the Next.js docs give for sharing
// data between generateMetadata and the page) hands the second caller the first one's promise, so a render reads
// the database at most once per load, and an unreachable database is tried once, not twice.
// The keys are plain values (the language, the path's destination id, the query string), because React's cache
// compares its arguments by identity.

/** An address's query parameters, as Next.js gives them to a page (lib/raw-params.ts). */
export type SearchParams = RawParams;

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
 * What the search view renders (the home page and a destination's page: app/_site/search-page.tsx SearchView): the
 * search page's data, and the seasons' current windows with their tours, for the gold band's row of season boxes.
 */
export interface SearchViewData extends SearchPageData {
  /** Every season with a current window (lib/season-counts.ts), with or without tours, in SEASON_IDS order. */
  seasons: SeasonCount[];
  /** This month and the next eleven with their tours, for the phone date sheet's 月份 (task 78; the shared cached read). */
  months: MonthCount[];
}

/** The search page's data and the seasons' counts, read side by side (the seasons through the shared cached read). */
async function searchViewData(db: Db, raw: RawParams, today: IsoDate, locale: Locale): Promise<SearchViewData> {
  const [search, seasons, months] = await Promise.all([
    loadSearchPage(db, raw, today, locale, cachedReads), seasonCounts(db, today, cachedReads), monthCounts(db, today, cachedReads),
  ]);
  return { ...search, seasons, months };
}

/**
 * The search page's data: on '/' (destinationId null; a `dest` in the query is ignored, see movedSearchHref) or on
 * a destination's page, whose id (from the path, already checked by the caller) is the destination. With the
 * seasons' counts for the band (searchViewData).
 */
export const loadSearch = cache(async (locale: Locale, destinationId: string | null, query: string): Promise<Loaded<SearchViewData>> => {
  const today = todayInHongKong();
  const { dest: _ignored, ...rest } = paramsOf(query);
  const raw = destinationId === null ? rest : { ...rest, dest: destinationId };
  return attempt('search page', today, async () => searchViewData(await requestDb(), raw, today, locale));
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

/**
 * A season's page's data: its tours as the search page reads them, the season's own count before any filter, and every
 * season's (the band's row of season boxes).
 */
export interface SeasonPageData {
  search: SearchPageData;
  /** The season's tours before any other filter (the heading's line, the description, noindex when none). */
  count: ListedCount;
  /** Every season with a current window, with its count (lib/season-counts.ts), this one among them. */
  seasons: SeasonCount[];
  /** This month and the next eleven with their tours, for the phone date sheet (task 78). */
  months: MonthCount[];
}

/** A season's page: its current window on the server's Hong Kong today, and the page's load. */
export interface SeasonLoad { window: SeasonWindow; load: Loaded<SeasonPageData> }

/**
 * A season's page's data (its id from the path, already checked by the caller): the season's current window on Hong
 * Kong's today (lib/seasons.ts currentWindow), read once here for the page and its metadata alike; null, with nothing
 * read, when the season has none (the page is then a 404). The search reads the departure window from the season: a
 * `from` or `to` in the query is ignored, and every other filter (the destination among them, as `dest`) is read as
 * on the search page. The season's own count comes from the read the sitemap and the destinations index share
 * (lib/season-counts.ts), so it is the same cached answer for all three seasons.
 */
export const loadSeason = cache(async (locale: Locale, seasonId: SeasonId, query: string): Promise<SeasonLoad | null> => {
  const today = todayInHongKong();
  const window = currentWindow(seasonId, today);
  if (window === null) return null;
  const { from: _from, to: _to, ...rest } = paramsOf(query);
  const load = await attempt('season page', today, async () => {
    const db = await requestDb();
    const [search, seasons, months] = await Promise.all([
      loadSearchPage(db, { ...rest, from: window.from, to: window.to }, today, locale, cachedReads),
      seasonCounts(db, today, cachedReads),
      monthCounts(db, today, cachedReads),
    ]);
    const count = seasons.find(s => s.window.season === seasonId)?.count ?? { tours: 0, operators: 0 };
    return { search, count, seasons, months };
  });
  return { window, load };
});

// The stored pages' loads. A stored page (its route file's `revalidate`) is made at build time and stored, then made
// again at most once an hour while the stored copy is served. Whatever it renders is stored as good, so a page that
// said "cannot read" would be served to everyone, without noindex, until the next good refresh. So these loaders
// never catch a failed read: it throws, the page is not made, and nothing is stored (Next.js keeps serving the copy
// it has; a page never made yet answers 500 with its language's error page, error.tsx). Their result has no
// { ok: false } case, so no stored page can render one. They read through storedDb (no connection()).
// An empty answer counts as a failed read too: the site lists thousands of tours, so a database that answers with
// no tours (or no operator with tours) is at fault, and its answer is not published for an hour. The per-request
// pages still show such an answer as it is.

/** A stored page's load: always the data. */
export type StoredLoad<T> = Extract<Loaded<T>, { ok: true }>;

/** How each stored-page error ends: what happens next, in a build and in a refresh. */
const STORED_OUTCOME = 'This page is stored, and is never made without its data: a build stops here, and a stored copy '
  + 'being refreshed stays in use.';

/**
 * The database handle could not be made (storedDb): a setting is missing or malformed. Its own message is passed on:
 * lib/db.ts and @hktours/db write those to name the setting (DATABASE_URL, DATABASE_CA_CERT) without its value.
 */
function storedHandleError(page: string, err: unknown): Error {
  if (!process.env.DATABASE_URL) {
    return new Error(
      `${page}: DATABASE_URL is not set. This page is stored: it is made when the site is built and again at most once ` +
      'an hour, and it needs the database to be made. Set DATABASE_URL (and DATABASE_CA_CERT if the database needs it), ' +
      'or build with BUILD_WITHOUT_DATABASE=1 (CI and local builds only) to make the stored pages per request instead.',
    );
  }
  const reason = err instanceof Error ? err.message : 'an unrecognised error';
  return new Error(`${page}: the database settings cannot be used: ${reason} ${STORED_OUTCOME}`);
}

/**
 * The errors pg gives without a code, each as a fixed word: their text is never passed on, since a driver's message
 * can carry the host or the user. Anything else without a code is 'unrecognised error'.
 */
const UNCODED: [RegExp, string][] = [
  [/^Query read timeout$/, 'query timeout'],
  [/connection timeout|^timeout expired$/i, 'connection timeout'],
  [/^Connection terminated/, 'connection closed'],
];

/** The error's code (ECONNREFUSED, 08006, 28P01…) when it has one, or a fixed word from UNCODED. */
function errorKind(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(code)) return code;
  const message = err instanceof Error ? err.message : '';
  return UNCODED.find(([pattern]) => pattern.test(message))?.[1] ?? 'unrecognised error';
}

/**
 * The error a stored page's failed read becomes: it names DATABASE_URL and the error's code or kind, never a value
 * (a build prints it, and the original error's text can hold the database's host and user, so it is not attached).
 */
function storedReadError(page: string, err: unknown): Error {
  return new Error(`${page}: the database at DATABASE_URL could not be read (${errorKind(err)}); the value is not shown. ${STORED_OUTCOME}`);
}

/**
 * Runs `load` with the stored pages' handle: its data, or it throws (storedHandleError, storedReadError, or the
 * empty-answer error when `isEmpty` says the data has no rows). Next.js's own signals pass through.
 */
async function stored<T>(page: string, today: IsoDate, load: (db: Db) => Promise<T>, isEmpty: (data: T) => boolean): Promise<StoredLoad<T>> {
  const now = new Date().toISOString();
  let db: Db;
  try {
    db = await storedDb();
  } catch (err) {
    unstable_rethrow(err);
    throw storedHandleError(page, err);
  }
  let data: T;
  try {
    data = await load(db);
  } catch (err) {
    unstable_rethrow(err);
    throw storedReadError(page, err);
  }
  if (isEmpty(data)) throw new Error(`${page}: the database answered with no rows (nothing listed now). ${STORED_OUTCOME}`);
  return { ok: true, today, now, data };
}

/** How many tours each destination has now: the destinations index's data, for its stored copy. No tours: an error. */
export const loadStoredCounts = cache(async (): Promise<StoredLoad<DestinationCounts>> => {
  const today = todayInHongKong();
  return stored('destinations index', today, db => cachedReads.countToursByDestination(db, today), counts => counts.all.tours === 0);
});

/**
 * The seasons' current windows with their tours, for the destinations index's stored copy (its row of season links).
 * A failed read throws, as every stored load's; seasons without tours are not an error (the index's own counts are
 * what must not be empty).
 */
export const loadStoredSeasons = cache(async (): Promise<StoredLoad<SeasonCount[]>> => {
  const today = todayInHongKong();
  return stored('destinations index', today, db => seasonCounts(db, today, cachedReads), () => false);
});

/**
 * The home page's data for its stored copy, in `locale`: the search page without any filter (no query string at all;
 * its filtered addresses are answered by its per-request copy, which uses loadSearch: lib/search-rewrites.ts), with
 * the seasons' counts for the band (searchViewData). No tours (none counted, or none found): an error. The seasons'
 * read failing is a failed read like any other (it throws); no season having tours is not an error.
 */
export const loadStoredSearch = cache(async (locale: Locale): Promise<StoredLoad<SearchViewData>> => {
  const today = todayInHongKong();
  return stored('home page', today, db => searchViewData(db, {}, today, locale),
    data => data.total === 0 || data.counts.all.tours === 0);
});

/**
 * Every operator the site lists, with its tours now: the operators index's data, for its stored copy. No operator
 * with tours: an error.
 */
export const loadStoredOperatorListings = cache(async (): Promise<StoredLoad<OperatorListing[]>> => {
  const today = todayInHongKong();
  return stored('operators index', today, async db => shownOperators(await cachedReads.getOperatorListings(db, today)),
    listings => !listings.some(o => o.tours > 0));
});
