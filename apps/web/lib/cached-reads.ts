import { unstable_cache } from 'next/cache';
import type { Destination, IsoDate } from '@hktours/core';
import {
  getOperators, getToursByKeys, searchTours,
  type Db, type OperatorInfo, type SearchInput, type SortKey, type TourCardData, type TourFilters,
} from '@hktours/db/read';
import type { Locale } from './i18n';

/*
 * The website's three database reads, each result kept in Next.js's data cache and reused by every visitor
 * who asks the same question, so most page views make no query (the data changes once a night).
 *
 * How old a result can be: it is fresh for READ_CACHE_SECONDS (an hour). After that, unstable_cache gives
 * the next visitor the kept result once more and fetches a new one in the background for the visitors after.
 * So a result is usually under about an hour old, but the first visitor after a quiet spell can see one as
 * old as that spell (never one from an earlier Hong Kong day, for the reads that take `today`: it is in their key).
 * If that background fetch fails, the kept result stays (visitors see it, not the error message) and the next
 * visitor tries again. With nothing kept, a failure reaches the page's error message, and nothing is stored.
 *
 * The key is built here, field by field, from values the address parsers already validated; the read then
 * runs on exactly what is in the key, so two requests can share an entry only if they ask the database the
 * same thing. The raw address never reaches it.
 */

/** How long a stored result is reused, in seconds: one hour, fixed. */
export const READ_CACHE_SECONDS = 3600;

/** The tag on every stored result, so they can all be refreshed at once later (revalidateTag). Unused today. */
export const READ_CACHE_TAG = 'db-reads';

/**
 * Stores what `load` returns under `key`, or gives back what is stored. A value must survive JSON (the data
 * cache stores JSON text), and `load` throwing must store nothing.
 */
export type CacheFn = <T>(key: string, load: () => Promise<T>) => Promise<T>;

/**
 * Next.js's data cache (unstable_cache). The key is the only key part, and the cached function is called with
 * no arguments, so no Db handle and no raw address becomes part of the stored key (Next adds only the cached
 * function's own source text, which is fixed per build).
 */
export const nextCache: CacheFn = (key, load) =>
  unstable_cache(load, [key], { revalidate: READ_CACHE_SECONDS, tags: [READ_CACHE_TAG] })();

/** No cache: every call asks the database. The loaders' default, which their tests use. */
export const runUncached: CacheFn = (_key, load) => load();

/** A search as the loaders ask it: the ranking for the destination sorts comes from the locale instead. */
export type SearchQuery = Omit<SearchInput, 'destinationOrder'>;

/** The three reads, with the same results as those of `@hktours/db/read`. */
export interface Reads {
  /** searchTours, with the destination sorts ranked in `locale`'s order of place names. */
  searchTours(db: Db, query: SearchQuery, locale: Locale): Promise<{ tours: TourCardData[]; total: number }>;
  getOperators(db: Db, opts?: { onlyWithGoodRun?: boolean }): Promise<OperatorInfo[]>;
  getToursByKeys(db: Db, keys: string[], today: IsoDate): Promise<Map<string, TourCardData>>;
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
  read: 'searchTours'; today: IsoDate; sort: SortKey; page: number;
  /** Only for the destination sorts; null otherwise. */
  locale: Locale | null;
  filters: KeyFilters;
}

/** Each once, in code-unit order; null for none, as searchTours treats an empty list. */
const canonicalList = <T extends string>(list: readonly T[] | undefined): T[] | null =>
  list && list.length > 0 ? [...new Set(list)].sort() : null;

const canonicalDestination = (d: Destination | undefined): Destination | null =>
  d ? { countryId: d.countryId, regionId: d.regionId ?? null } : null;

function searchKey(query: SearchQuery, locale: Locale): SearchKey {
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
    read: 'searchTours', today: query.today, sort: query.sort, page: query.page,
    locale: usesDestinationOrder(query.sort) ? locale : null,
    filters,
  };
}

/** The search a key stands for, built from the key alone. */
function searchInput(key: SearchKey, orderFor: (locale: Locale) => string[]): SearchInput {
  const filters = Object.fromEntries(Object.entries(key.filters).filter(([, v]) => v !== null)) as TourFilters;
  return {
    filters, sort: key.sort, page: key.page, today: key.today,
    destinationOrder: key.locale === null ? undefined : orderFor(key.locale),
  };
}

/**
 * The three reads through `cache`. `orderFor` gives the destination ranking for a language (a pure function
 * of the places data and the language); it runs inside the cached read, from the key's locale, so the long
 * list is never part of a key and an entry can only hold the order of the language in its key.
 */
export function createReads(orderFor: (locale: Locale) => string[], cache: CacheFn = nextCache): Reads {
  return {
    searchTours(db, query, locale) {
      const key = searchKey(query, locale);
      return cache(JSON.stringify(key), () => searchTours(db, searchInput(key, orderFor)));
    },

    getOperators(db, opts = {}) {
      const key = { read: 'getOperators', onlyWithGoodRun: opts.onlyWithGoodRun === true };
      return cache(JSON.stringify(key), () => getOperators(db, { onlyWithGoodRun: key.onlyWithGoodRun }));
    },

    async getToursByKeys(db, keys, today) {
      const wanted = [...new Set(keys)];
      if (wanted.length === 0) return new Map(); // as getToursByKeys: no query
      const key = { read: 'getToursByKeys', today, keys: [...wanted].sort() };
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
  };
}
