'use client';

import { useSyncExternalStore } from 'react';
import { decodeChain, encodeChain, type ChainState } from '@hktours/core';
import { chainHref } from './chain-href';

// The visitor's trip (連續行程), remembered in this browser (task 71). The trip lives in the trip page's address, which
// the server validates on every visit; this keeps the visitor's own trip, so it survives leaving the page: the bottom
// bar's 連續行程 tab (and the header's link from 640px) go back to it, and the tab's badge counts its tours on every
// page. Like the saved tours (lib/saved-tours.ts): localStorage, shared by every tab of the site (a change in one
// reaches the others through the `storage` event), read only in the browser (the server renders no badge and plain
// /chain links; useSyncExternalStore with getNoRememberedTrip), never sent anywhere by itself.
//
// The remembered trip changes only by the visitor's own action on a trip (tripToRemember): adding a tour (on the trip
// page or a search page), ×, 清空, 還原, the rest setting, or "改用這個行程". The page marks such a press
// (markTripAction) before it navigates, and the trip it then shows is remembered. Any other trip address (Back or
// Forward to an older state, a link someone shared, ?gap= alone) is shown as asked and changes nothing here, except
// that the remembered trip's own address, shown with tours the server has dropped, prunes them.
//
// What is kept is only what the page's address says of the trip, as the address writes it (encodeChain: legs and
// gap), and it is read back through decodeChain, so a hand-edited entry is cleaned exactly as an address is. It is
// never trusted further: opening it is opening that address, and the server drops any tour that has gone.
//
// Where storage cannot be used (site data blocked, or full), the trip is remembered in memory instead, for as long as
// the page stays open (moving between the site's pages keeps it), and nothing is said: the trip still works through
// its address, as it did before.

/** The localStorage entry: JSON { legs, gap } as encodeChain writes them for the address. */
export const TRIP_KEY = 'hktours.trip';

/** A remembered trip: its chain (one leg or more), the number of tours, and its address without a language. */
export interface RememberedTrip { chain: ChainState; count: number; path: string }

let cache: RememberedTrip | null | undefined;
let memory: RememberedTrip | null = null;
const listeners = new Set<() => void>();

function tripOf(chain: ChainState): RememberedTrip | null {
  return chain.legs.length === 0 ? null : { chain, count: chain.legs.length, path: chainHref(chain) };
}

/** The stored entry, cleaned as an address is; null when there is none, or nothing in it can be read. */
function parse(raw: string | null): RememberedTrip | null {
  if (raw === null) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const { legs, gap } = (parsed ?? {}) as { legs?: unknown; gap?: unknown };
  if (typeof legs !== 'string') return null;
  return tripOf(decodeChain({ legs, gap: typeof gap === 'string' ? gap : null }));
}

function load(): RememberedTrip | null {
  try {
    return parse(window.localStorage.getItem(TRIP_KEY));
  } catch {
    return memory;
  }
}

function notify() {
  for (const listener of listeners) listener();
}

/** The trip remembered now; the same object until it changes (a stable snapshot for useSyncExternalStore). */
export function getRememberedTrip(): RememberedTrip | null {
  if (cache === undefined) cache = load();
  return cache;
}

/** For server rendering and hydration: the server cannot know, so it renders as if no trip were remembered. */
export function getNoRememberedTrip(): null {
  return null;
}

/**
 * Remembers this trip, as the trip page's validated address has it; a trip with no legs forgets it (清空, or every tour
 * of it gone). Kept in memory when storage cannot be written.
 */
export function rememberTrip(chain: ChainState): void {
  const next = tripOf(chain);
  memory = next;
  try {
    if (next) window.localStorage.setItem(TRIP_KEY, JSON.stringify(encodeChain(chain)));
    else window.localStorage.removeItem(TRIP_KEY);
  } catch {
    // Kept in memory only (above).
  }
  if ((getRememberedTrip()?.path ?? null) === (next?.path ?? null)) return;
  cache = next;
  notify();
}

/** Another tab changed the trip (or cleared the site's storage): read it again. */
function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== TRIP_KEY) return;
  cache = undefined;
  notify();
}

/** Subscribes to changes here and in the site's other tabs. */
export function subscribeTrip(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/** The remembered trip, after hydration (null before, and on the server). */
export function useRememberedTrip(): RememberedTrip | null {
  return useSyncExternalStore(subscribeTrip, getRememberedTrip, getNoRememberedTrip);
}

/** What the trip page shows of the remembered trip: `hydrated` is false on the server and during hydration. */
type TripMemoryState = { hydrated: boolean; trip: RememberedTrip | null };
const SERVER: TripMemoryState = { hydrated: false, trip: null };
let state: TripMemoryState | null = null;
function getState(): TripMemoryState {
  const trip = getRememberedTrip();
  if (state === null || state.trip !== trip) state = { hydrated: true, trip };
  return state;
}
/** The remembered trip, and whether it can be known yet (after hydration). */
export function useTripMemory(): TripMemoryState {
  return useSyncExternalStore(subscribeTrip, getState, () => SERVER);
}

// The visitor's own action on a trip, marked by the press just before the page navigates, taken by the trip page once
// the new address is shown.
let acted = false;
/** Marks the navigation about to happen as the visitor's own change to a trip: the trip it lands on is remembered. */
export function markTripAction(): void {
  acted = true;
}
/** Whether an action is marked, without taking it. */
export function peekTripAction(): boolean {
  return acted;
}
/** Takes the mark (once). */
export function takeTripAction(): boolean {
  const was = acted;
  acted = false;
  return was;
}

// A move through the browser's history (Back or Forward, or a page loaded that way), until the visitor next presses
// anything (a click, which Enter on a link or button also makes): the bare /chain then stays where history put it rather than going to the remembered trip, so Back is
// never pushed forward again.
let traversing = false;
if (typeof window !== 'undefined') {
  try {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    traversing = entry?.type === 'back_forward';
  } catch {
    // No navigation timing: not known, so not a traversal.
  }
  window.addEventListener('popstate', () => { traversing = true; });
  window.addEventListener('click', () => { traversing = false; }, true);
}
/** Whether the page now shown was reached by moving through history (Back or Forward). */
export function isHistoryTraversal(): boolean {
  return traversing;
}

/**
 * Whether the trip page should remember the trip it shows (`shown`, as the server validated it), given the trip its
 * address asked for (`requested`, before any tour was dropped), what is remembered, and whether the visitor's own
 * action led here. Only that action, or the remembered trip's own address (to prune tours that have gone), changes
 * the memory; nothing remembered yet is not filled by merely opening a trip someone shared.
 */
export function tripToRemember(shown: ChainState, requested: ChainState, remembered: RememberedTrip | null, action: boolean): boolean {
  if (action) return true;
  if (remembered === null) return false;
  return remembered.path === chainHref(requested) || remembered.path === chainHref(shown);
}

/** Tests only: forget the in-memory copies, as a reload would. */
export function resetTripCache(): void {
  cache = undefined;
  memory = null;
  acted = false;
  traversing = false;
}
