'use client';

import { useSyncExternalStore } from 'react';

// What the phone's trip page (components/TripPhone) carries from one address to the next: the last removal, which it
// offers to undo, and where focus goes once the next address is shown. Both are made by a press in the browser and
// live in memory only (a reload forgets them); the server never has any.

/**
 * The last removal: what was removed ('first' or 'last' tour, or 'all' for 清空), the removed tour's name for screen
 * readers (none for 清空), the address it left and the one it went to (lib/chain-href's, without a language).
 */
export interface TripUndo { what: 'first' | 'last' | 'all'; label?: string; from: string; to: string }

/** Where focus goes when the trip or the choosing screen is shown next. */
export type TripFocus = 'first' | 'last' | 'add' | 'undo' | 'rest' | 'pick';

let undo: TripUndo | null = null;
let focus: TripFocus | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
/** The removal offered for undoing now. */
export const getTripUndo = () => undo;
const getNoUndo = () => null;

/** Records a removal to offer to undo (replacing any earlier one). */
export function setTripUndo(next: TripUndo | null): void {
  if (next === undo) return;
  undo = next;
  for (const listener of listeners) listener();
}

/** The removal to offer to undo, after hydration. */
export function useTripUndo(): TripUndo | null {
  return useSyncExternalStore(subscribe, getTripUndo, getNoUndo);
}

/** Asks for focus to move to `target` once the next address is shown. */
export function requestTripFocus(target: TripFocus): void {
  focus = target;
}

/** The focus asked for, if it is one of `targets` (once: the caller moves it); otherwise null, and it stays asked for. */
export function takeTripFocus(targets: readonly TripFocus[]): TripFocus | null {
  const target = focus;
  if (target === null || !targets.includes(target)) return null;
  focus = null;
  return target;
}
