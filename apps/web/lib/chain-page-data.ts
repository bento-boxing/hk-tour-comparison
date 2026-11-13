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
  /** Legs in the address that were dropped (tour gone, date no longer offered or past, overlap). */
  droppedCount: number;
  /** Departure window for the next leg; null when there are no legs or the chain is full. */
  window: { from: IsoDate; to: IsoDate } | null;
  /** The tours that can come next, in that window; null exactly when `window` is. */
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
 * Everything the chain page renders, from the raw address. Database errors are passed on to the caller.
 * The address is untrusted: only what decodeChain and parseSearchParams validated reaches the database.
 */
export async function loadChainPage(db: Db, raw: RawParams, today: IsoDate): Promise<ChainPageData> {
  const decoded = decodeChain({ legs: first(raw, 'legs'), gap: first(raw, 'gap') });
  // The departure window comes from the gap, so from/to in the address are not read.
  const search = parseSearchParams(raw, places, { includeDates: false });

  const [tours, operators] = await Promise.all([
    getToursByKeys(db, decoded.legs.map(l => l.tourKey), today),
    getOperators(db),
  ]);
  const { legs, droppedCount } = resolveChain(decoded, tours, today);
  const address: ChainAddress = {
    chain: { legs: legs.map(l => ({ tourKey: l.tour.key, departure: l.departure })), gap: decoded.gap },
    search,
  };

  const full = legs.length >= MAX_CHAIN_LEGS;
  const window = full ? null : nextWindow(legs, decoded.gap);
  const next = window
    ? await searchTours(db, {
      filters: { ...search.filters, dateFrom: window.from, dateTo: window.to },
      sort: search.sort, page: search.page, today,
    })
    : null;

  return { address, legs, droppedCount, window, next, full, operators };
}
