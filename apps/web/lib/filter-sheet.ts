import { addDays, OPERATOR_IDS, type IsoDate, type OperatorId, type PlacesIndex } from '@hktours/core';
import type { DateWindow, TourFilters } from '@hktours/db/read';
import { countOf } from './destinations';
import type { SeasonCount } from './season-counts';
import { isSeasonState, type SeasonWindow } from './seasons';
import { buildSearchQuery, parseSearchParams, withFilters, type SearchState } from './search-params';

// The phone filter sheet's rules (components/FilterSheet.tsx, opened by 篩選 in the phone bar of components/FilterBar):
// which sections it holds, how many filters are on (the 篩選 badge), what 清除全部 leaves, and how its fields become
// the next search state. Every value goes through the address rules (parseSearchParams), as the wide pills' do, so
// the sheet never sets a filter a reload would drop.

/** Which of the sheet's sections a page has: the same choices as the wide row (FilterBar's `show`). */
export interface SheetSections { dates: boolean; operators: boolean; exclude: boolean }

/**
 * The sheet's fields, as typed (strings, '' for empty) and ticked: the departure window (from, to), the travel window
 * (tfrom, tto), the length (dmin, dmax), the price (pmin, pmax), the operators (op) and the countries left out (ex).
 * Named as the address names them, so the same form works without JavaScript (a GET form).
 */
export interface SheetDraft {
  from: string; to: string; tfrom: string; tto: string;
  dmin: string; dmax: string; pmin: string; pmax: string;
  op: OperatorId[]; ex: string[];
}

/** The one-tap lengths, the same at every width (the wide row's 日數 popover and the phone sheet): 1–3, 4–6, 7–9, 10+ days. */
export const DAY_PRESETS: readonly { min: number; max?: number }[] = [{ min: 1, max: 3 }, { min: 4, max: 6 }, { min: 7, max: 9 }, { min: 10 }];

/** The sheet's one-tap price ceilings (HK$, per person): only the highest price is set. */
export const SHEET_PRICE_CEILINGS: readonly number[] = [1_000, 3_000, 5_000, 10_000];

/** The fields for a state. */
export function draftOf(state: SearchState): SheetDraft {
  const f = state.filters;
  const text = (v: string | number | undefined) => (v === undefined ? '' : String(v));
  return {
    from: text(f.dateFrom), to: text(f.dateTo), tfrom: text(f.travelFrom), tto: text(f.travelTo),
    dmin: text(f.daysMin), dmax: text(f.daysMax), pmin: text(f.priceMin), pmax: text(f.priceMax),
    op: [...(f.operators ?? [])], ex: [...(f.excludeCountryIds ?? [])],
  };
}

/** A reversed pair of typed dates is swapped, as the wide date pills do (in the address, a reversed pair is dropped). */
const inOrder = (from: string, to: string): [string, string] => (from && to && from > to ? [to, from] : [from, to]);

/**
 * The state the sheet's fields give, back on page 1: the page's other choices (destination, sort, rows per page, a
 * fixed operator) kept; only the sections the page has are read from the fields. Through the address rules.
 */
export function stateFromDraft(state: SearchState, draft: SheetDraft, sections: SheetSections, places: PlacesIndex): SearchState {
  const current: Record<string, string> = Object.fromEntries(buildSearchQuery({ ...state, page: 1 }));
  const trim = (s: string) => s.trim();
  const changes: Record<string, string> = {
    dmin: trim(draft.dmin), dmax: trim(draft.dmax), pmin: trim(draft.pmin), pmax: trim(draft.pmax),
  };
  if (sections.dates) {
    [changes.from, changes.to] = inOrder(trim(draft.from), trim(draft.to));
    [changes.tfrom, changes.tto] = inOrder(trim(draft.tfrom), trim(draft.tto));
  }
  if (sections.operators) changes.op = OPERATOR_IDS.filter(id => draft.op.includes(id)).join(',');
  if (sections.exclude) changes.ex = draft.ex.join(',');
  const merged = Object.fromEntries(Object.entries({ ...current, ...changes }).filter(([, v]) => v !== ''));
  return parseSearchParams(merged, places);
}

/** True when two states give the same address (so applying the sheet unchanged navigates nowhere). */
export function sameSearch(a: SearchState, b: SearchState): boolean {
  return buildSearchQuery(a).toString() === buildSearchQuery(b).toString();
}

/**
 * The state 清除全部 leaves: every filter the sheet holds removed, back on page 1. The destination stays (the band
 * holds it), so does the order, and so does what the page's path fixes: a season page's days (`fixedDates`), an
 * operator's page's operator (its sheet has no operator section).
 */
export function clearedState(state: SearchState, sections: SheetSections, fixedDates?: DateWindow | null): SearchState {
  const patch: Partial<TourFilters> = { daysMin: undefined, daysMax: undefined, priceMin: undefined, priceMax: undefined };
  if (sections.dates) {
    Object.assign(patch, { dateFrom: fixedDates?.from, dateTo: fixedDates?.to, travelFrom: undefined, travelTo: undefined });
  }
  if (sections.operators) patch.operators = undefined;
  if (sections.exclude) patch.excludeCountryIds = undefined;
  return withFilters(state, patch);
}

/**
 * How many filters are on, for the 篩選 badge: one per section that is set, whatever it holds (a pair of dates or a
 * range is one; three operators are one). The destination is not counted (the band shows it), nor the order, nor a
 * season page's own days, nor an operator page's own operator (the page's path fixes those).
 */
export function activeFilterCount(state: SearchState, sections: SheetSections, fixedDates?: DateWindow | null): number {
  const f = state.filters;
  const fixed = fixedDates != null && f.dateFrom === fixedDates.from && f.dateTo === fixedDates.to;
  return [
    sections.dates && !fixed && (f.dateFrom !== undefined || f.dateTo !== undefined),
    sections.dates && (f.travelFrom !== undefined || f.travelTo !== undefined),
    f.daysMin !== undefined || f.daysMax !== undefined,
    f.priceMin !== undefined || f.priceMax !== undefined,
    sections.operators && (f.operators?.length ?? 0) > 0,
    sections.exclude && (f.excludeCountryIds?.length ?? 0) > 0,
  ].filter(Boolean).length;
}

/** A Hong Kong calendar month as a departure window: `offset` 0 is the month of `today`, 1 the next. */
export function monthWindow(today: IsoDate, offset: number): DateWindow {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1 + offset;
  const first = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const next = new Date(Date.UTC(year, month + 1, 1)).toISOString().slice(0, 10);
  return { from: first, to: addDays(next, -1) };
}

/**
 * The seasons the sheet offers as one-tap departure windows: those the page knows have tours (for its destination,
 * when it has one; the same counts as the band's season boxes), soonest first, and the one the state's dates are
 * (on its own page, or chosen) whatever its tours, so it shows as chosen.
 */
export function sheetSeasons(state: SearchState, seasons: SeasonCount[]): SeasonWindow[] {
  const place = state.filters.destination ?? null;
  const toursOf = (s: SeasonCount) => (place
    ? countOf(place, { all: { tours: s.count.tours, operators: s.count.operators }, destinations: s.count.destinations ?? [] }).tours
    : s.count.tours);
  return seasons
    .filter(s => toursOf(s) > 0 || isSeasonState(s.window, state))
    .map(s => s.window)
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}
