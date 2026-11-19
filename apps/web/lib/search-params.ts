import { isIsoDate, OPERATOR_IDS, type Destination, type OperatorId, type PlacesIndex } from '@hktours/core';
import type { SortKey, TourFilters } from '@hktours/db/read';
import { destinationPath } from './destinations';

/** Everything the search address can say. Built only by parseSearchParams, so every value in it is valid. */
export interface SearchState { filters: TourFilters; sort: SortKey; page: number }

type RawParams = Record<string, string | string[] | undefined>;

export const DEFAULT_SORT: SortKey = 'price';
/** Each order then its reverse. The bare names are the four from before, with the same meaning. */
export const SORT_KEYS: readonly SortKey[] = [
  'price', 'price-desc', 'days', 'days-desc', 'date', 'date-desc', 'destination', 'destination-desc',
];

/** The earliest date the address accepts (the database has no year 0). */
const FIRST_DATE = '0001-01-01';

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
 * includeDates false is used by the chain page, which sets the date window itself: it drops both the
 * departure window (from, to) and the travel window (tfrom, tto).
 */
export function parseSearchParams(raw: RawParams, places: PlacesIndex, opts: { includeDates?: boolean } = {}): SearchState {
  const includeDates = opts.includeDates ?? true;
  // A real calendar date from year 1 on: isIsoDate accepts year 0000, which Postgres refuses (an error page).
  const isoDate = (name: string) => {
    const text = first(raw, name);
    return text !== undefined && isIsoDate(text) && text >= FIRST_DATE ? text : undefined;
  };
  // Both ends, or neither when the window ends before it starts. Same-format ISO dates compare as strings.
  const datePair = (fromName: string, toName: string): [string | undefined, string | undefined] => {
    const from = isoDate(fromName);
    const to = isoDate(toName);
    return from !== undefined && to !== undefined && from > to ? [undefined, undefined] : [from, to];
  };

  let dateFrom: string | undefined;
  let dateTo: string | undefined;
  let travelFrom: string | undefined;
  let travelTo: string | undefined;
  if (includeDates) {
    [dateFrom, dateTo] = datePair('from', 'to');
    [travelFrom, travelTo] = datePair('tfrom', 'tto');
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
    travelFrom, travelTo,
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
  set('tfrom', f.travelFrom);
  set('tto', f.travelTo);
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

/**
 * The address of a search state: the destination's page ('/tours/japan', see lib/destinations.ts) or the search
 * page ('/') for none, plus the query for the other filters, the sort and the page; the path alone for the default
 * state. The destination is never in the query here (only the chain page keeps `dest` there). A path without a
 * language: see localeHref.
 */
export function searchHref(state: SearchState): string {
  const query = buildSearchQuery(state);
  query.delete('dest');
  const path = destinationPath(state.filters.destination);
  return query.size > 0 ? `${path}?${query}` : path;
}

/**
 * Where an old search address that named its destination in the query now is: '/?dest=japan&dmin=5' →
 * '/tours/japan?dmin=5' (a path without a language). Only what parseSearchParams keeps is carried over, and `ex`
 * not at all (the search page ignores it). Null when `dest` names no destination (unknown, misspelt or a retired
 * region): such an address stays where it is and its `dest` is ignored, as before.
 */
export function movedSearchHref(raw: RawParams, places: PlacesIndex): string | null {
  const state = parseSearchParams(raw, places);
  if (!state.filters.destination) return null;
  const { excludeCountryIds: _ignored, ...filters } = state.filters;
  return searchHref({ ...state, filters });
}
