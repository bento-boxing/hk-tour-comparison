import type { IsoDate } from '@hktours/core';
import type { Db, WindowCount } from '@hktours/db/read';
import type { Reads } from './cached-reads';
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
