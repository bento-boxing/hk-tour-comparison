import { decodeChain, places, MAX_CHAIN_LEGS, type IsoDate } from '@hktours/core';
import { getOperators, getToursByKeys, searchTours, type Db, type OperatorInfo, type TourCardData } from '@hktours/db/read';
import { nextWindow, resolveChain, type ResolvedLeg } from './chain';
import type { ChainAddress } from './chain-href';
import { parseSearchParams } from './search-params';

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
  next: { tours: TourCardData[]; total: number } | null;
  /** MAX_CHAIN_LEGS legs: no more can be added. */
  full: boolean;
  operators: OperatorInfo[];
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
 */
export async function loadChainPage(db: Db, raw: RawParams, today: IsoDate): Promise<ChainPageData> {
  const legsText = first(raw, 'legs');
  const decoded = decodeChain({ legs: legsText, gap: first(raw, 'gap') });
  // A shared link that lost a malformed leg still tells the visitor something was removed.
  const unreadable = Math.max(0, legsAsked(legsText) - decoded.legs.length);
  // The departure window comes from the gap, so from/to in the address are not read.
  const search = parseSearchParams(raw, places, { includeDates: false });

  const [tours, operators] = await Promise.all([
    getToursByKeys(db, decoded.legs.map(l => l.tourKey), today),
    getOperators(db),
  ]);
  const resolved = resolveChain(decoded, tours, today);
  const { legs } = resolved;
  const droppedCount = resolved.droppedCount + unreadable;
  const address: ChainAddress = {
    chain: { legs: legs.map(l => ({ tourKey: l.tour.key, departure: l.departure })), gap: decoded.gap },
    search,
  };

  const full = legs.length >= MAX_CHAIN_LEGS;
  const departWindow = full ? null : nextWindow(legs, decoded.gap);
  const next = departWindow
    ? await searchTours(db, {
      filters: { ...search.filters, dateFrom: departWindow.from, dateTo: departWindow.to },
      sort: search.sort, page: search.page, today,
    })
    : null;

  return { address, legs, droppedCount, departWindow, next, full, operators };
}
