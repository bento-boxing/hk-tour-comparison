import { decodeChain, places, MAX_CHAIN_LEGS, type ChainState, type IsoDate } from '@hktours/core';
import type { Db, OperatorInfo } from '@hktours/db/read';
import { withoutTitle, type TourRow } from './tour-row';
import type { Reads } from './cached-reads';
import { nextWindow, resolveChain, type ResolvedLeg } from './chain';
import type { ChainAddress } from './chain-href';
import { DEFAULT_LOCALE, type Locale } from './i18n';
import { first, type RawParams } from './raw-params';
import { pageSizeOf, parseSearchParams } from './search-params';
import { filterBarOperators, uncachedReads } from './search-page-data';

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
  /**
   * The tours that can come next, in that window; null when `departWindow` is, except on the choosing screen of an
   * empty trip, where it is every tour that can be the first (any upcoming date).
   */
  next: { tours: TourRow[]; total: number } | null;
  /**
   * The address names no trip at all (neither `legs` nor `gap`): the bare /chain the header and the bottom bar link to
   * before the page's scripts run, which asks for the trip this browser remembers (components/TripPhone TripMemory).
   * Every address the page makes has a gap.
   */
  bare: boolean;
  /**
   * The trip the address asked for, as decodeChain read it, before any tour was dropped: the browser compares it with
   * the trip it remembers (lib/remembered-trip tripToRemember), so a remembered trip whose tours have gone is pruned.
   */
  requested: ChainState;
  /** MAX_CHAIN_LEGS legs: no more can be added. */
  full: boolean;
  /** Every operator, for looking one up by id (the strip's and cards' names and colours). */
  operators: OperatorInfo[];
  /** The operators the filter bar offers: see filterBarOperators. */
  filterOperators: OperatorInfo[];
}

/**
 * How many legs the raw `legs` value tried to give, as decodeChain would count them: its non-empty
 * comma-separated parts, at most MAX_CHAIN_LEGS (decodeChain ignores the rest without reading them).
 */
function legsAsked(text: string | undefined): number {
  if (text === undefined) return 0;
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

  const [tours, operators] = await Promise.all([
    reads.getToursByKeys(db, decoded.legs.map(l => l.tourKey), today),
    reads.getOperators(db),
  ]);
  const filterOperators = filterBarOperators(operators, search.filters.operators);
  // The tours' own names are not shown, so they are not sent to the browser.
  const rows = new Map([...tours].map(([key, tour]) => [key, withoutTitle(tour)]));
  const resolved = resolveChain(decoded, rows, today);
  const { legs } = resolved;
  const droppedCount = resolved.droppedCount + unreadable;
  const full = legs.length >= MAX_CHAIN_LEGS;
  // The phone's screen for choosing the next tour (task 71): there is nothing to choose for a full trip.
  const pick = first(raw, 'pick') === '1' && !full;
  const address: ChainAddress = {
    chain: { legs: legs.map(l => ({ tourKey: l.tour.key, departure: l.departure })), gap: decoded.gap },
    search,
    ...(pick ? { pick } : {}),
  };

  const departWindow = full ? null : nextWindow(legs, decoded.gap);
  const page = { sort: search.sort, page: search.page, pageSize: pageSizeOf(search), today };
  const found = departWindow
    ? await reads.searchTours(db, { filters: { ...search.filters, dateFrom: departWindow.from, dateTo: departWindow.to }, ...page }, locale)
    // Choosing the first tour: any tour that leaves after today, with the visitor's filters.
    : pick && legs.length === 0 ? await reads.searchTours(db, { filters: search.filters, ...page }, locale) : null;
  const next = found && { tours: found.tours.map(withoutTitle), total: found.total };

  return { address, legs, droppedCount, departWindow, next, full, operators, filterOperators, bare: legsText === undefined && first(raw, 'gap') === undefined, requested: decoded };
}
