import { encodeChain, DEFAULT_GAP, type ChainState, type IsoDate } from '@hktours/core';

/** `/chain?legs=…&gap=…` for this chain (`legs` left out when there are none). */
export function chainHref(chain: ChainState): string {
  const encoded = encodeChain(chain);
  const query = new URLSearchParams();
  if (encoded.legs) query.set('legs', encoded.legs);
  query.set('gap', encoded.gap);
  return `/chain?${query}`;
}

/** The chaining page for a chain that starts with this tour on this date, with the default gap. */
export function chainStartHref(tourKey: string, departure: IsoDate): string {
  return chainHref({ legs: [{ tourKey, departure }], gap: { ...DEFAULT_GAP } });
}
