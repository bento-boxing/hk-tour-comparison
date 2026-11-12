import type { IsoDate } from './types';
import { isIsoDate } from './schema';
import { addDays } from './chain';

export interface PriceSnapshot { date: IsoDate; priceHkd: number }
export type PriceChange =
  | { kind: 'lower'; diffHkd: number; sinceDate: IsoDate }   // diffHkd is positive
  | { kind: 'higher'; diffHkd: number; sinceDate: IsoDate }
  | { kind: 'same'; sinceDate: IsoDate };

/** Nights of snapshots to keep: enough to always hold the one from a week ago. */
export const SNAPSHOT_KEEP_NIGHTS = 8;

/**
 * Compares tonight's price with the one from a week ago.
 *
 * The baseline is the snapshot dated `today - 7`; failing that, the oldest
 * snapshot from `today - 7` to `today - 1`. Since `today - 7` is the oldest
 * date in that window, both rules come down to "the oldest snapshot in the
 * window". Snapshots outside the window, or whose date is not a real
 * `YYYY-MM-DD` date, are ignored.
 *
 * currentPriceHkd is tonight's from-price. Returns null when there is nothing to compare with.
 */
export function comparePrice(currentPriceHkd: number, snapshots: PriceSnapshot[], today: IsoDate): PriceChange | null {
  const weekAgo = addDays(today, -7);
  const yesterday = addDays(today, -1);

  // Valid YYYY-MM-DD strings sort in date order, so plain string comparison is safe here.
  let baseline: PriceSnapshot | null = null;
  for (const snapshot of snapshots) {
    if (!isIsoDate(snapshot.date) || snapshot.date < weekAgo || snapshot.date > yesterday) continue;
    if (baseline === null || snapshot.date < baseline.date) baseline = snapshot;
  }
  if (baseline === null) return null;

  const sinceDate = baseline.date;
  const diff = currentPriceHkd - baseline.priceHkd;
  if (diff < 0) return { kind: 'lower', diffHkd: -diff, sinceDate };
  if (diff > 0) return { kind: 'higher', diffHkd: diff, sinceDate };
  return { kind: 'same', sinceDate };
}
