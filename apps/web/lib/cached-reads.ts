import { unstable_cache } from 'next/cache';
import type { Destination, IsoDate } from '@hktours/core';
import {
  countToursByDestination, getOperatorListings, getOperators, getToursByKeys, isPageSize, searchTours, PAGE_SIZE,
  type DestinationCounts, type Db, type OperatorInfo, type OperatorListing, type PageSize, type SearchInput, type SortKey, type TourCardData,
  type TourFilters,
} from '@hktours/db/read';
import type { Locale } from './i18n';

/*
 * The website's five database reads, each result kept in Next.js's data cache and reused by every visitor
 * who asks the same question, so most page views make no query (the data changes once a night).
 *
 * A result handed to a page is at most an hour old (READ_CACHE_SECONDS), by the server's clock. Each entry carries
 * the time it was read (ageLimited). Once that is an hour ago, or more than CLOCK_TOLERANCE_SECONDS in the future,
 * the entry is not used: that read goes straight to the database (and an error then reaches the page's error
 * message, as with no entry; on a stored page it stops the page being made). A stored page (the home page without a
 * filter, /tours, /operators: their route files' `revalidate`) is itself kept up to an hour, so what it shows can be
 * up to about two hours old, and older on a page nobody has visited for a while: its first visitor then gets the old
 * copy while a new one is made. The same lookup has usually started Next's own refresh of the entry
 * for the visitors after; not when Next still counts the entry as fresh (its clock is the time the entry was
 * written, a moment after ours), in which case each visit reads directly until Next's hour is up too.
 * A clock up to the tolerance ahead on the instance that wrote an entry can stretch the hour by that much.
 * A failed read is never stored.
 *
 * The key is built here, field by field, from values the address parsers already validated; the read then
 * runs on exactly what is in the key, so two requests can share an entry only if they ask the database the
 * same thing. The raw address never reaches it.
 *
 * Every key also starts with BUILD_ID: the Vercel environment and git commit, when Vercel provides them to
 * the functions (the project setting "Enable access to System Environment Variables"). Entries are then kept
 * per commit and environment: a new commit's deployment starts with an empty cache, while a redeploy of the
 * same commit reuses its entries. Without those variables every build is "local" and every deployment shares
 * entries; the one-hour limit still holds.
 */

/** How long a stored result is reused, in seconds: one hour, fixed. */
export const READ_CACHE_SECONDS = 3600;

/**
 * The tag on every stored result. Next.js also puts it on every stored page that used such a result (the home page,
 * /tours and /operators), so `revalidateTag(READ_CACHE_TAG, 'max')` would mark the results and those pages out of
 * date together, each served as it is until its new copy is made. Nothing calls it: the refresh is by time only. Never
 * `revalidateTag(…, { expire: 0 })` or `revalidatePath`: they drop the stored pages, which then answer 500 while the
 * database is down.
 */
export const READ_CACHE_TAG = 'db-reads';

/**
 * Stores what `load` returns under `key`, or gives back what is stored. A value must survive JSON (the data
 * cache stores JSON text), and `load` throwing must store nothing. The reads take one of these; so does
 * ageLimited, which wraps a plain store.
 */
export type CacheFn = <T>(key: string, load: () => Promise<T>) => Promise<T>;

/**
 * The build and environment whose code wrote an entry, part of every key: `<VERCEL_ENV>:<VERCEL_GIT_COMMIT_SHA>`
 * (production, preview or development; the deployment's commit), 'local' for a part Vercel does not give,
 * and just 'local' when it gives neither.
 */
export function buildId(env: Record<string, string | undefined>): string {
  const environment = env.VERCEL_ENV || 'local';
  const commit = env.VERCEL_GIT_COMMIT_SHA || 'local';
  return environment === 'local' && commit === 'local' ? 'local' : `${environment}:${commit}`;
}

/** This server's build id, read once. */
export const BUILD_ID = buildId(process.env);

/**
 * What the stored function's source text reads as, for every read. unstable_cache puts the cached function's
 * `toString()` into every key, before our key part (`${cb.toString()}-${keyParts}`, as its docs say: "the
 * stringified version of your function"). Our key part already names the read completely, and the bundler writes
 * the same closure with different variable names in different bundles (the pages' and the sitemap's), which made
 * each kind of route keep its own copy of the same result. So the stored function always reads as this one text.
 */
export const STORED_READ_SOURCE = 'hktours cached read';

/**
 * Next.js's data cache (unstable_cache), as a plain store. The key is the only key part, and the cached
 * function is called with no arguments, so no Db handle and no raw address becomes part of the stored key.
 * The function's own source text, which Next also puts in the key, is the fixed STORED_READ_SOURCE.
 */
export const nextStore: CacheFn = (key, load) => {
  const stored = () => load();
  Object.defineProperty(stored, 'toString', { value: () => STORED_READ_SOURCE });
  return unstable_cache(stored, [key], { revalidate: READ_CACHE_SECONDS, tags: [READ_CACHE_TAG] })();
};

/**
 * How far ahead of this server's clock a stored time may be and still count: clocks of different servers
 * differ a little. An entry stamped further in the future is treated as over the hour.
 */
export const CLOCK_TOLERANCE_SECONDS = 60;

/** What ageLimited stores: the value and when it was read (milliseconds since 1970). */
interface Stamped<T> { at: number; value: T }

function isFresh<T>(entry: unknown, now: number): entry is Stamped<T> {
  const at = (entry as Partial<Stamped<T>> | null)?.at;
  if (typeof at !== 'number' || !Number.isFinite(at)) return false;
  const age = now - at;
  return age >= -CLOCK_TOLERANCE_SECONDS * 1000 && age < READ_CACHE_SECONDS * 1000;
}

/**
 * `store` with a hard age limit. Each value is stored with the time it was read; an entry read
 * READ_CACHE_SECONDS ago or longer, stamped more than CLOCK_TOLERANCE_SECONDS in the future, or without a
 * readable time, is never returned: `load` runs instead, for this caller only, and its result or its error is
 * what the caller gets. (Next's unstable_cache serves an entry past its own lifetime once more while
 * refreshing it in the background; that refresh still happens, so usually the next caller gets a fresh entry.)
 * `now` is the clock, for tests.
 */
export function ageLimited(store: CacheFn, now: () => number = Date.now): CacheFn {
  return async <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const entry = await store<Stamped<T>>(key, async () => {
      const value = await load();
      return { at: now(), value };
    });
    return isFresh<T>(entry, now()) ? entry.value : load();
  };
}

/** The pages' cache: Next.js's data cache, never returning a result older than the hour. */
export const nextCache: CacheFn = ageLimited(nextStore);

/** No cache: every call asks the database. The loaders' default, which their tests use. */
export const runUncached: CacheFn = (_key, load) => load();

/** A search as the loaders ask it: the ranking for the destination sorts comes from the locale instead. */
export type SearchQuery = Omit<SearchInput, 'destinationOrder'>;

/** The five reads, with the same results as those of `@hktours/db/read`. */
export interface Reads {
  /** searchTours, with the destination sorts ranked in `locale`'s order of place names. */
  searchTours(db: Db, query: SearchQuery, locale: Locale): Promise<{ tours: TourCardData[]; total: number }>;
  getOperators(db: Db, opts?: { onlyWithGoodRun?: boolean }): Promise<OperatorInfo[]>;
  getToursByKeys(db: Db, keys: string[], today: IsoDate): Promise<Map<string, TourCardData>>;
  /** How many tours, from how many operators, are listed now: in all, per country and per region. */
  countToursByDestination(db: Db, today: IsoDate): Promise<DestinationCounts>;
  /** Every operator with its home address and how many tours it lists now, in all and per country. */
  getOperatorListings(db: Db, today: IsoDate): Promise<OperatorListing[]>;
}

/**
 * True for the sorts whose order depends on the destination ranking (and so on the language). Every other
 * sort gives the same result whatever ranking is passed, so its key leaves the language out.
 */
export function usesDestinationOrder(sort: SortKey): boolean {
  return sort === 'destination' || sort === 'destination-desc';
}

/** Every filter, always present: null where the search leaves it off. */
type KeyFilters = { [K in keyof Required<TourFilters>]: NonNullable<TourFilters[K]> | null };

interface SearchKey {
  build: string; read: 'searchTours'; today: IsoDate; sort: SortKey; page: number;
  /** Rows per page, always written (the default too), as searchTours reads it: anything but 48 or 96 is 24. */
  pageSize: PageSize;
  /** Only for the destination sorts; null otherwise. */
  locale: Locale | null;
  filters: KeyFilters;
}

/** Each once, in code-unit order; null for none, as searchTours treats an empty list. */
const canonicalList = <T extends string>(list: readonly T[] | undefined): T[] | null =>
  list && list.length > 0 ? [...new Set(list)].sort() : null;

const canonicalDestination = (d: Destination | undefined): Destination | null =>
  d ? { countryId: d.countryId, regionId: d.regionId ?? null } : null;

function searchKey(build: string, query: SearchQuery, locale: Locale): SearchKey {
  const f = query.filters;
  // Listed one by one, in a fixed order: KeyFilters makes a filter added to TourFilters a type error here
  // until it is part of the key.
  const filters: KeyFilters = {
    destination: canonicalDestination(f.destination),
    excludeCountryIds: canonicalList(f.excludeCountryIds),
    dateFrom: f.dateFrom ?? null, dateTo: f.dateTo ?? null,
    travelFrom: f.travelFrom ?? null, travelTo: f.travelTo ?? null,
    daysMin: f.daysMin ?? null, daysMax: f.daysMax ?? null,
    priceMin: f.priceMin ?? null, priceMax: f.priceMax ?? null,
    operators: canonicalList(f.operators),
  };
  return {
    build, read: 'searchTours', today: query.today, sort: query.sort, page: query.page,
    pageSize: isPageSize(query.pageSize) ? query.pageSize : PAGE_SIZE,
    locale: usesDestinationOrder(query.sort) ? locale : null,
    filters,
  };
}

/** The search a key stands for, built from the key alone. */
function searchInput(key: SearchKey, orderFor: (locale: Locale) => string[]): SearchInput {
  const filters = Object.fromEntries(Object.entries(key.filters).filter(([, v]) => v !== null)) as TourFilters;
  return {
    filters, sort: key.sort, page: key.page, pageSize: key.pageSize, today: key.today,
    destinationOrder: key.locale === null ? undefined : orderFor(key.locale),
  };
}

/**
 * The five reads through `cache`. `orderFor` gives the destination ranking for a language (a pure function
 * of the places data and the language); it runs inside the cached read, from the key's locale, so the long
 * list is never part of a key and an entry can only hold the order of the language in its key. `build` is the
 * build id every key starts with.
 */
export function createReads(
  orderFor: (locale: Locale) => string[], cache: CacheFn = nextCache, build: string = BUILD_ID,
): Reads {
  return {
    searchTours(db, query, locale) {
      const key = searchKey(build, query, locale);
      return cache(JSON.stringify(key), () => searchTours(db, searchInput(key, orderFor)));
    },

    getOperators(db, opts = {}) {
      const key = { build, read: 'getOperators', onlyWithGoodRun: opts.onlyWithGoodRun === true };
      return cache(JSON.stringify(key), () => getOperators(db, { onlyWithGoodRun: key.onlyWithGoodRun }));
    },

    async getToursByKeys(db, keys, today) {
      const wanted = [...new Set(keys)];
      if (wanted.length === 0) return new Map(); // as getToursByKeys: no query
      const key = { build, read: 'getToursByKeys', today, keys: [...wanted].sort() };
      // A Map does not survive JSON, so the entry holds its [key, card] pairs.
      const pairs = await cache(JSON.stringify(key), async () => [...(await getToursByKeys(db, key.keys, key.today)).entries()]);
      // Rebuilt in the order the caller asked, as getToursByKeys itself orders its Map.
      const byKey = new Map(pairs);
      const result = new Map<string, TourCardData>();
      for (const k of wanted) {
        const card = byKey.get(k);
        if (card) result.set(k, card);
      }
      return result;
    },

    countToursByDestination(db, today) {
      // The only input is today (the server's Hong Kong date), so one entry per build and day serves every page.
      const key = { build, read: 'countToursByDestination', today };
      return cache(JSON.stringify(key), () => countToursByDestination(db, key.today));
    },

    getOperatorListings(db, today) {
      // As the counts: today is the only input, so one entry per build and day serves the operators' pages, their
      // index and the sitemap.
      const key = { build, read: 'getOperatorListings', today };
      return cache(JSON.stringify(key), () => getOperatorListings(db, key.today));
    },
  };
}
