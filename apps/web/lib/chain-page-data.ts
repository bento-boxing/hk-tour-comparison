import { decodeChain, places, MAX_CHAIN_LEGS, type IsoDate } from '@hktours/core';
import type { Db, OperatorInfo } from '@hktours/db/read';
import { withoutTitle, type TourRow } from './tour-row';
import type { Reads } from './cached-reads';
import { nextWindow, resolveChain, type ResolvedLeg } from './chain';
import type { ChainAddress } from './chain-href';
import { DEFAULT_LOCALE, type Locale } from './i18n';
import { pageSizeOf, parseSearchParams } from './search-params';
import { filterBarOperators, uncachedReads } from './search-page-data';

type RawParams = Record<string, string | string[] | undefined>;

export interface ChainPageData {
  /** What every link on the page is built from: the legs that resolved, the clean gap, the filters (no dates). */
  address: ChainAddress;
  legs: ResolvedLeg[];
  /**
   * Legs in the address that were dropped: ones decodeChain could not read (and those after them, up to
   * MAX_CHAIN_LEGS), and ones resolveChain dropped (tour gone, date no longer offered or past, overlap).
   */
  droppedCount: number;
  /** Departure window for the next leg; null when there are no legs or the chain is full. */
  departWindow: { from: IsoDate; to: IsoDate } | null;
  /** The tours that can come next, in that window; null exactly when `departWindow` is. */
  next: { tours: TourRow[]; total: number } | null;
  /** MAX_CHAIN_LEGS legs: no more can be added. */
  full: boolean;
  /** Every operator, for looking one up by id (the strip's and cards' names and colours). */
  operators: OperatorInfo[];
  /** The operators the filter bar offers: see filterBarOperators. */
  filterOperators: OperatorInfo[];
}

/** The first value of a parameter, when it is a string at all; null otherwise. */
function first(raw: RawParams, name: string): string | null {
  const value = Object.hasOwn(raw, name) ? raw[name] : undefined;
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === 'string' ? text : null;
}

/**
 * How many legs the raw `legs` value tried to give, as decodeChain would count them: its non-empty
 * comma-separated parts, at most MAX_CHAIN_LEGS (decodeChain ignores the rest without reading them).
 */
function legsAsked(text: string | null): number {
  if (text === null) return 0;
  return Math.min(text.split(',').filter(part => part !== '').length, MAX_CHAIN_LEGS);
}

/**
 * Everything the chain page renders, from the raw address. Database errors are passed on to the caller.
 * The address is untrusted: only what decodeChain and parseSearchParams validated reaches the database.
 * The list offers every sort order, as the search page does; `locale` decides the destination sorts' order.
 * `reads` is how the database is read: the page passes cachedReads.
 */
export async function loadChainPage(
  db: Db, raw: RawParams, today: IsoDate, locale: Locale = DEFAULT_LOCALE, reads: Reads = uncachedReads,
): Promise<ChainPageData> {
  const legsText = first(raw, 'legs');
  const decoded = decodeChain({ legs: legsText, gap: first(raw, 'gap') });
  // A shared link that lost a malformed leg still tells the visitor something was removed.
  const unreadable = Math.max(0, legsAsked(legsText) - decoded.legs.length);
  // The departure window comes from the gap, so neither from/to nor the travel window (tfrom/tto) in the
  // address is read.
  const search = parseSearchParams(raw, places, { includeDates: false });

  const [tours, operators, withGoodRun] = await Promise.all([
    reads.getToursByKeys(db, decoded.legs.map(l => l.tourKey), today),
    reads.getOperators(db),
    reads.getOperators(db, { onlyWithGoodRun: true }),
  ]);
  const filterOperators = filterBarOperators(operators, withGoodRun, search.filters.operators);
  // The tours' own names are not shown, so they are not sent to the browser.
  const rows = new Map([...tours].map(([key, tour]) => [key, withoutTitle(tour)]));
  const resolved = resolveChain(decoded, rows, today);
  const { legs } = resolved;
  const droppedCount = resolved.droppedCount + unreadable;
  const address: ChainAddress = {
    chain: { legs: legs.map(l => ({ tourKey: l.tour.key, departure: l.departure })), gap: decoded.gap },
    search,
  };

  const full = legs.length >= MAX_CHAIN_LEGS;
  const departWindow = full ? null : nextWindow(legs, decoded.gap);
  const found = departWindow
    ? await reads.searchTours(db, {
      filters: { ...search.filters, dateFrom: departWindow.from, dateTo: departWindow.to },
      sort: search.sort, page: search.page, pageSize: pageSizeOf(search), today,
    }, locale)
    : null;
  const next = found && { tours: found.tours.map(withoutTitle), total: found.total };

  return { address, legs, droppedCount, departWindow, next, full, operators, filterOperators };
}
