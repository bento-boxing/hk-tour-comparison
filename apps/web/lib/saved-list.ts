import { OPERATOR_IDS, TOUR_CODE_PATTERN } from '@hktours/core';

// The saved tours' list as the saved page's address carries it (`/saved?t=egl:KIX5,jetour:THB`), for the server and
// the browser alike (no storage here: that is lib/saved-tours.ts). The browser keeps the list; the address is how the
// saved page asks the server for those tours, and it makes a list shareable by link.

/** At most this many tours are saved, and at most this many are read from an address. */
export const SAVED_CAP = 100;

/**
 * How many comma-separated parts of an address's `t` are looked at, at most: enough for SAVED_CAP tours with some
 * junk or repeats among them, and a bound on the work a hand-made address can ask for.
 */
const MAX_PARTS = SAVED_CAP * 2;

const KEY_PATTERN = /^([a-z]+):(.*)$/;
const isOperatorId = (s: string) => (OPERATOR_IDS as readonly string[]).includes(s);

/** A tour's stable key as the site writes it, `<operator>:<code>` ('egl:KIX5'): a known operator and a valid code. */
export function isTourKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = KEY_PATTERN.exec(value);
  return match !== null && isOperatorId(match[1]) && TOUR_CODE_PATTERN.test(match[2]);
}

/**
 * The saved page's address for these keys (newest saved first), without a language (the caller adds it with
 * localeHref): '/saved' for none. The longest, SAVED_CAP keys of the longest operator id and a 40-character code,
 * is about 5,500 characters with the encoding (lib/saved-list.test.ts).
 */
export function savedHref(keys: readonly string[]): string {
  return keys.length === 0 ? '/saved' : `/saved?${new URLSearchParams({ t: keys.join(',') })}`;
}

type RawParams = Record<string, string | string[] | undefined>;

/**
 * The tour keys an address asks for, in its order: each a valid key (isTourKey), each once, at most SAVED_CAP; only
 * the first `t` counts. `dropped` counts the parts left out (unreadable, repeated, or past the cap or the parts looked
 * at), so the page can say that something in its address was not read. Never throws.
 */
export function parseSavedKeys(raw: RawParams): { keys: string[]; dropped: number } {
  const value = Object.hasOwn(raw, 't') ? raw.t : undefined;
  const text = Array.isArray(value) ? value[0] : value;
  if (typeof text !== 'string' || text === '') return { keys: [], dropped: 0 };
  const parts = text.split(',');
  const keys: string[] = [];
  for (const part of parts.slice(0, MAX_PARTS)) {
    if (keys.length === SAVED_CAP) break;
    if (isTourKey(part) && !keys.includes(part)) keys.push(part);
  }
  return { keys, dropped: parts.filter(part => part !== '').length - keys.length };
}
