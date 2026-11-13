import { encodeChain, sanitiseGap, DEFAULT_GAP, MAX_CHAIN_LEGS, type ChainLegRef, type ChainState, type IsoDate } from '@hktours/core';
import { buildSearchQuery, type SearchState } from './search-params';

/** `legs` (left out when there are none) and `gap`. */
function chainQuery(chain: ChainState): URLSearchParams {
  const encoded = encodeChain(chain);
  const query = new URLSearchParams();
  if (encoded.legs) query.set('legs', encoded.legs);
  query.set('gap', encoded.gap);
  return query;
}

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
 * and a clean gap) and the next-leg list's filters, sort and page. The page builds it from decodeChain,
 * resolveChain and parseSearchParams(…, { includeDates: false }); every link and navigation on the page
 * is made from it with the helpers below, never from the raw address.
 */
export interface ChainAddress { chain: ChainState; search: SearchState }

/** `/chain?legs=…&gap=…&dest=…&ex=…&…&sort=…&page=…`. Never `from`/`to`: the page sets the window from the gap. */
export function chainPageHref(address: ChainAddress): string {
  const query = chainQuery(address.chain);
  const { dateFrom: _from, dateTo: _to, ...filters } = address.search.filters;
  for (const [name, value] of buildSearchQuery({ ...address.search, filters })) query.set(name, value);
  return `/chain?${query}`;
}

/** The chain with this leg added at the end (unchanged when it is already full), back on page 1. Filters and gap stay. */
export function withLegAdded(address: ChainAddress, leg: ChainLegRef): ChainAddress {
  const legs = address.chain.legs.length >= MAX_CHAIN_LEGS ? address.chain.legs : [...address.chain.legs, leg];
  return { chain: { ...address.chain, legs }, search: { ...address.search, page: 1 } };
}

/** The chain without its last leg, back on page 1. Filters and gap stay. */
export function withoutLastLeg(address: ChainAddress): ChainAddress {
  return { chain: { ...address.chain, legs: address.chain.legs.slice(0, -1) }, search: { ...address.search, page: 1 } };
}

/** A new gap for the next leg (cleaned as the address would clean it), back on page 1. Legs and filters stay. */
export function withGap(address: ChainAddress, gap: { min: number; max: number }): ChainAddress {
  return { chain: { ...address.chain, gap: sanitiseGap(gap.min, gap.max) }, search: { ...address.search, page: 1 } };
}

/** New filters or sort from the filter bar, back on page 1. Legs and gap stay. */
export function withSearch(address: ChainAddress, search: SearchState): ChainAddress {
  return { chain: address.chain, search: { ...search, page: 1 } };
}

/** Another page of the next-leg list. Everything else stays. */
export function withPage(address: ChainAddress, page: number): ChainAddress {
  return { chain: address.chain, search: { ...address.search, page } };
}
