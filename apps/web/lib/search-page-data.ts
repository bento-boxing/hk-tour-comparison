import { places, type IsoDate, type OperatorId, type PlacesIndex } from '@hktours/core';
import type { Db, DestinationCounts, OperatorInfo } from '@hktours/db/read';
import { withoutTitle, type TourRow } from './tour-row';
import { createReads, runUncached, type Reads } from './cached-reads';
import { DEFAULT_LOCALE, type Locale } from './i18n';
import { placeName } from './place-names';
import { pageSizeOf, parseSearchParams, type SearchState } from './search-params';

export interface SearchPageData {
  state: SearchState;
  /** This page's tours, without their own names (the rows never show them: lib/tour-row.ts). */
  tours: TourRow[];
  /** Every match before paging. */
  total: number;
  /** Every operator, for looking one up by id (a card's name and colour). */
  operators: OperatorInfo[];
  /** The operators the filter bar offers: see filterBarOperators. */
  filterOperators: OperatorInfo[];
  /** How many tours are listed now, before any filter: in all, per country and per region (the heading's line). */
  counts: DestinationCounts;
}

/**
 * The operators the filter bar offers, in the canonical order: those that have had a good run (the others
 * have no tours), plus any the address selects without one (an old or hand-made link), so that selection
 * still shows by name and can be undone.
 */
export function filterBarOperators(
  all: OperatorInfo[], withGoodRun: OperatorInfo[], selected: OperatorId[] = [],
): OperatorInfo[] {
  const offered = new Set<OperatorId>([...withGoodRun.map(o => o.id), ...selected]);
  return all.filter(o => offered.has(o.id));
}

/**
 * How each language orders place names: Traditional Chinese by stroke count, Simplified by pinyin, English
 * alphabetically.
 */
const COLLATOR_LOCALE: Record<Locale, string> = { 'zh-Hant': 'zh-Hant-u-co-stroke', 'zh-Hans': 'zh-Hans-u-co-pinyin', en: 'en' };

const orders = new WeakMap<PlacesIndex, Map<Locale, string[]>>();

/**
 * Every region id in the order a visitor reading `locale` expects the names a card shows ('日本 · 關西'):
 * by country name, then region name, in that language's order; equal names by id. Passed to the search
 * as the destination sorts' ranking. Worked out once per places index and language.
 */
export function destinationOrder(index: PlacesIndex, locale: Locale): string[] {
  const byLocale = orders.get(index) ?? new Map<Locale, string[]>();
  orders.set(index, byLocale);
  const cached = byLocale.get(locale);
  if (cached) return cached;

  const compare = new Intl.Collator(COLLATOR_LOCALE[locale]).compare;
  const name = (place: { nameZh: string; nameEn: string } | undefined, id: string) => (place ? placeName(place, locale) : id);
  const order = index.data.regions
    .map(r => ({ id: r.id, country: name(index.country(r.countryId), r.countryId), region: name(r, r.id) }))
    .sort((a, b) => compare(a.country, b.country) || compare(a.region, b.region) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(r => r.id);
  byLocale.set(locale, order);
  return order;
}

const placesOrder = (locale: Locale) => destinationOrder(places, locale);

/** The reads through Next.js's data cache, each result reused for an hour (see cached-reads.ts). The pages use these. */
export const cachedReads: Reads = createReads(placesOrder);

/** The same reads straight to the database, every time. The loaders' default, so their tests need no Next.js. */
export const uncachedReads: Reads = createReads(placesOrder, runUncached);

/**
 * Everything the search page renders, from the raw address. Database errors are passed on to the caller.
 * The address is untrusted: only what parseSearchParams validated reaches the database. Its `dest` is the
 * destination: the pages put the one from the path there (/tours/<id>), and leave it out on '/'.
 * `locale` decides the destination sorts' order (see destinationOrder). `reads` is how the database is read:
 * the pages pass cachedReads.
 */
export async function loadSearchPage(
  db: Db, raw: Record<string, string | string[] | undefined>, today: IsoDate, locale: Locale = DEFAULT_LOCALE,
  reads: Reads = uncachedReads,
): Promise<SearchPageData> {
  const parsed = parseSearchParams(raw, places);
  // The search page has no control for exclusions (that is the chain page's), so an `ex` in the
  // address would filter invisibly, with no way to undo it. It is ignored here.
  const { excludeCountryIds: _ignored, ...filters } = parsed.filters;
  const state: SearchState = { ...parsed, filters };

  const [{ tours, total }, operators, withGoodRun, counts] = await Promise.all([
    reads.searchTours(db, { filters, sort: state.sort, page: state.page, pageSize: pageSizeOf(state), today }, locale),
    reads.getOperators(db),
    reads.getOperators(db, { onlyWithGoodRun: true }),
    reads.countToursByDestination(db, today),
  ]);
  const filterOperators = filterBarOperators(operators, withGoodRun, filters.operators);
  return { state, tours: tours.map(withoutTitle), total, operators, filterOperators, counts };
}
