import { isIsoDate, OPERATOR_IDS, type Destination, type OperatorId, type PlacesIndex } from '@hktours/core';
import type { SortKey, TourFilters } from '@hktours/db/read';

/** Everything the search address can say. Built only by parseSearchParams, so every value in it is valid. */
export interface SearchState { filters: TourFilters; sort: SortKey; page: number }

type RawParams = Record<string, string | string[] | undefined>;

export const DEFAULT_SORT: SortKey = 'price';
export const SORT_KEYS: readonly SortKey[] = ['price', 'days', 'date', 'destination'];

export const DAYS_RANGE = { min: 1, max: 60 } as const;
export const PRICE_RANGE = { min: 0, max: 2_000_000 } as const;

/** The first value of a parameter, when it is a string at all. */
function first(raw: RawParams, name: string): string | undefined {
  const value = Object.hasOwn(raw, name) ? raw[name] : undefined;
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === 'string' ? text : undefined;
}

/** Plain decimal digits only: no sign, fraction, exponent, hex or spaces. At most 9 digits, so always a safe integer. */
const DIGITS = /^\d{1,9}$/;

function intInRange(text: string | undefined, range: { min: number; max: number }): number | undefined {
  if (text === undefined || !DIGITS.test(text)) return undefined;
  const n = Number(text);
  return n >= range.min && n <= range.max ? n : undefined;
}

/** Comma-separated ids that pass `known`, each once, in the order given. */
function idList(text: string | undefined, known: (id: string) => boolean): string[] {
  if (text === undefined) return [];
  return [...new Set(text.split(',').filter(known))];
}

/** Both ends when given; swapped when reversed. */
function range(min: number | undefined, max: number | undefined): { min?: number; max?: number } {
  if (min !== undefined && max !== undefined && min > max) return { min: max, max: min };
  return { min, max };
}

function destination(text: string | undefined, places: PlacesIndex): Destination | undefined {
  if (!text) return undefined;
  const region = places.region(text);
  if (region) return { countryId: region.countryId, regionId: region.id };
  if (places.country(text)) return { countryId: text, regionId: null };
  return undefined;
}

/** A copy without the keys whose value is undefined, so states compare and serialise cleanly. */
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Reads the search state from the page address. Never throws: anything invalid is dropped (see the
 * address table in the task brief). A repeated parameter uses its first value.
 * includeDates false is used by the chain page, which sets the date window itself.
 */
export function parseSearchParams(raw: RawParams, places: PlacesIndex, opts: { includeDates?: boolean } = {}): SearchState {
  const includeDates = opts.includeDates ?? true;

  let dateFrom: string | undefined;
  let dateTo: string | undefined;
  if (includeDates) {
    const from = first(raw, 'from');
    const to = first(raw, 'to');
    dateFrom = from !== undefined && isIsoDate(from) ? from : undefined;
    dateTo = to !== undefined && isIsoDate(to) ? to : undefined;
    // Same-format ISO dates compare correctly as strings.
    if (dateFrom !== undefined && dateTo !== undefined && dateFrom > dateTo) dateFrom = dateTo = undefined;
  }

  const days = range(intInRange(first(raw, 'dmin'), DAYS_RANGE), intInRange(first(raw, 'dmax'), DAYS_RANGE));
  const price = range(intInRange(first(raw, 'pmin'), PRICE_RANGE), intInRange(first(raw, 'pmax'), PRICE_RANGE));

  const opIds = new Set(idList(first(raw, 'op'), id => (OPERATOR_IDS as readonly string[]).includes(id)));
  const operators: OperatorId[] = OPERATOR_IDS.filter(id => opIds.has(id)); // canonical order
  const excludeCountryIds = idList(first(raw, 'ex'), id => places.country(id) !== undefined);

  const filters: TourFilters = compact({
    destination: destination(first(raw, 'dest'), places),
    excludeCountryIds: excludeCountryIds.length > 0 ? excludeCountryIds : undefined,
    dateFrom, dateTo,
    daysMin: days.min, daysMax: days.max,
    priceMin: price.min, priceMax: price.max,
    operators: operators.length > 0 ? operators : undefined,
  });

  const sortText = first(raw, 'sort');
  const sort = SORT_KEYS.find(key => key === sortText) ?? DEFAULT_SORT;
  const page = intInRange(first(raw, 'page'), { min: 1, max: Number.MAX_SAFE_INTEGER }) ?? 1;

  return { filters, sort, page };
}

/** The address query for a state. Omits defaults and empty values so addresses stay short. */
export function buildSearchQuery(state: SearchState): URLSearchParams {
  const { filters: f, sort, page } = state;
  const query = new URLSearchParams();
  const set = (name: string, value: string | number | undefined) => { if (value !== undefined) query.set(name, String(value)); };
  const list = (name: string, values: string[] | undefined) => { if (values && values.length > 0) query.set(name, values.join(',')); };

  set('dest', f.destination ? f.destination.regionId ?? f.destination.countryId : undefined);
  list('ex', f.excludeCountryIds);
  set('from', f.dateFrom);
  set('to', f.dateTo);
  set('dmin', f.daysMin);
  set('dmax', f.daysMax);
  set('pmin', f.priceMin);
  set('pmax', f.priceMax);
  list('op', f.operators);
  if (sort !== DEFAULT_SORT) set('sort', sort);
  if (page !== 1) set('page', page);
  return query;
}

/** The state with these filters changed (undefined or an empty list removes one), back on page 1. */
export function withFilters(state: SearchState, patch: Partial<TourFilters>): SearchState {
  const merged = Object.entries({ ...state.filters, ...patch });
  const filters = Object.fromEntries(merged.filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)));
  return { ...state, filters, page: 1 };
}

/** The path plus the query, or the path alone for the default state. */
export function searchHref(state: SearchState, pathname = '/'): string {
  const query = buildSearchQuery(state).toString();
  return query ? `${pathname}?${query}` : pathname;
}
