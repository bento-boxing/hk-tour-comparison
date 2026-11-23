import {
  encodeChain, sanitiseGap, DEFAULT_GAP, MAX_CHAIN_LEGS, type ChainLegRef, type ChainState, type Destination, type IsoDate,
} from '@hktours/core';
import { buildSearchQuery, withFilters, type SearchState } from './search-params';

/** `legs` (left out when there are none) and `gap`. */
function chainQuery(chain: ChainState): URLSearchParams {
  const encoded = encodeChain(chain);
  const query = new URLSearchParams();
  if (encoded.legs) query.set('legs', encoded.legs);
  query.set('gap', encoded.gap);
  return query;
}

// Every address here is the chaining page's path without a language ('/chain?…'); whoever links or navigates to
// it puts it in the page's language with localeHref (lib/locale-path.ts): '/en/chain?…' in English.

/** `/chain?legs=…&gap=…` for this chain (`legs` left out when there are none). */
export function chainHref(chain: ChainState): string {
  return `/chain?${chainQuery(chain)}`;
}

/** The chaining page for a chain that starts with this tour on this date, with the default gap. */
export function chainStartHref(tourKey: string, departure: IsoDate): string {
  return chainHref({ legs: [{ tourKey, departure }], gap: { ...DEFAULT_GAP } });
}

/**
 * Everything the chain page's address says, already validated: the chain (only the legs that resolved,
 * and a clean gap), the next-leg list's filters, sort and page, and whether a phone shows the screen for choosing
 * the next tour (`pick`, task 71) rather than the trip. The page builds it from decodeChain, resolveChain and
 * parseSearchParams(…, { includeDates: false }); every link and navigation on the page is made from it with the
 * helpers below, never from the raw address.
 */
export interface ChainAddress { chain: ChainState; search: SearchState; pick?: boolean }

/**
 * `/chain?legs=…&gap=…&pick=1&dest=…&ex=…&…&sort=…&page=…` (`pick=1` only on the choosing screen). Never
 * `tfrom`/`tto`, and `from`/`to` only for a trip with no tour yet (task 75: the first tour's departure window, chosen
 * in the filter sheet); once a tour is in, the page sets the window from the gap, so adding one drops them.
 */
export function chainPageHref(address: ChainAddress): string {
  const query = chainQuery(address.chain);
  if (address.pick) query.set('pick', '1');
  const { dateFrom, dateTo, travelFrom: _tfrom, travelTo: _tto, ...rest } = address.search.filters;
  const filters = address.chain.legs.length === 0 ? { ...rest, dateFrom, dateTo } : rest;
  for (const [name, value] of buildSearchQuery({ ...address.search, filters })) query.set(name, value);
  return `/chain?${query}`;
}

/** A trip with these legs, on the trip (not the choosing screen), back on page 1. Filters and gap stay. */
function withLegs(address: ChainAddress, legs: ChainLegRef[]): ChainAddress {
  return { chain: { ...address.chain, legs }, search: { ...address.search, page: 1 } };
}

/**
 * The chain with this leg added at the end (unchanged when it is already full), back on page 1 and on the trip (a
 * phone returns from the choosing screen). Filters and gap stay.
 */
export function withLegAdded(address: ChainAddress, leg: ChainLegRef): ChainAddress {
  return withLegs(address, address.chain.legs.length >= MAX_CHAIN_LEGS ? address.chain.legs : [...address.chain.legs, leg]);
}

/** The chain without its last leg, back on page 1, on the trip. Filters and gap stay. */
export function withoutLastLeg(address: ChainAddress): ChainAddress {
  return withLegs(address, address.chain.legs.slice(0, -1));
}

/**
 * The chain without its first leg (the second becomes the first), back on page 1, on the trip. Filters and gap stay.
 * What is left is a valid trip: its legs were in order and still are, and the gap never applies to legs already chosen.
 */
export function withoutFirstLeg(address: ChainAddress): ChainAddress {
  return withLegs(address, address.chain.legs.slice(1));
}

/** No legs at all (清空), on the trip. Filters and gap stay. */
export function withoutLegs(address: ChainAddress): ChainAddress {
  return withLegs(address, []);
}

/** The phone's screen for choosing the next (or the first) tour for this trip, from page 1. */
export function pickScreen(address: ChainAddress): ChainAddress {
  return { ...address, search: { ...address.search, page: 1 }, pick: true };
}

/** The trip itself, as the choosing screen's ← and the bottom bar show it: no `pick`, page 1. */
export function tripScreen(address: ChainAddress): ChainAddress {
  return withLegs(address, address.chain.legs);
}

/**
 * A new gap for the next leg (cleaned as the address would clean it), back on page 1. Legs, filters and the screen
 * stay.
 */
export function withGap(address: ChainAddress, gap: { min: number; max: number }): ChainAddress {
  return { ...address, chain: { ...address.chain, gap: sanitiseGap(gap.min, gap.max) }, search: { ...address.search, page: 1 } };
}

/** New filters or sort from the filter bar, back on page 1. Legs, gap and the screen stay. */
export function withSearch(address: ChainAddress, search: SearchState): ChainAddress {
  return { ...address, search: { ...search, page: 1 } };
}

/** A destination from the search box or the country panels (null clears it), back on page 1. Legs, gap and the other filters stay. */
export function withDestination(address: ChainAddress, destination: Destination | null): ChainAddress {
  // withFilters drops a key whose value is undefined, so clearing leaves no `destination` behind.
  return withSearch(address, withFilters(address.search, { destination: destination ?? undefined }));
}
