import type { IsoDate } from '@hktours/core';
import type { Db, WindowCount } from '@hktours/db/read';
import type { Reads } from './cached-reads';
import { monthWindow } from './filter-sheet';
import { currentWindows, type SeasonWindow } from './seasons';

/** A season's current window and how many tours leave inside it, before any other filter: in all and per destination. */
export interface SeasonCount { window: SeasonWindow; count: WindowCount }

/**
 * Every season's current window on `today` (lib/seasons.ts currentWindows; a season without one is left out) with its
 * tours: one read for all of them (countToursInWindows), so the season pages, the destinations index and the sitemap
 * share one cached answer per build and day. Database errors are passed on.
 */
export async function seasonCounts(db: Db, today: IsoDate, reads: Pick<Reads, 'countToursInWindows'>): Promise<SeasonCount[]> {
  const windows = currentWindows(today);
  const counts = await reads.countToursInWindows(db, today, windows);
  return windows.map((window, i) => ({ window, count: counts[i] ?? { tours: 0, operators: 0 } }));
}

/** A month as a departure window (its 1st to its last day) and the tours leaving inside it, in all and per destination. */
export interface MonthCount { window: { from: IsoDate; to: IsoDate }; count: WindowCount }

/** How many months the phone date sheet looks at: this month and the next eleven. */
export const MONTHS_AHEAD = 12;

/**
 * This month and the next eleven (Hong Kong's) with their tours, for the phone date sheet's 月份 (task 78): one read for
 * all twelve through the shared cached read (countToursInWindows; the windows follow from today, so it is one entry per
 * build and day, as the seasons' read is). Database errors are passed on.
 */
export async function monthCounts(db: Db, today: IsoDate, reads: Pick<Reads, 'countToursInWindows'>): Promise<MonthCount[]> {
  const windows = Array.from({ length: MONTHS_AHEAD }, (_, i) => monthWindow(today, i));
  const counts = await reads.countToursInWindows(db, today, windows);
  return windows.map((window, i) => ({ window, count: counts[i] ?? { tours: 0, operators: 0 } }));
}
