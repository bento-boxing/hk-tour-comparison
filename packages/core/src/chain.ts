import type { IsoDate } from './types';
import { isIsoDate } from './schema';

/**
 * Calendar arithmetic for chaining tours. Every date is a `YYYY-MM-DD` string
 * handled as UTC midnight, so the machine's timezone never matters. Only
 * `todayInHongKong` looks at a clock, and it reads it in Hong Kong time.
 */

export const DEFAULT_GAP = { min: 1, max: 3 } as const;
export const MAX_GAP_DAYS = 30;

const MS_PER_DAY = 86_400_000;

function toUtcMs(date: IsoDate): number {
  if (!isIsoDate(date)) throw new RangeError(`Expected a real date as YYYY-MM-DD, got "${date}"`);
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: IsoDate, n: number): IsoDate {
  return new Date(toUtcMs(date) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

/** `b - a` in days. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / MS_PER_DAY);
}

/** Last day of the tour: departure + days - 1. */
export function tourEndDate(departure: IsoDate, days: number): IsoDate {
  return addDays(departure, days - 1);
}

/**
 * Departure dates that leave `gapMin`..`gapMax` full free days after a tour
 * that ends on `endDate`: from `end + gapMin + 1` to `end + gapMax + 1`.
 */
export function gapWindow(endDate: IsoDate, gapMin: number, gapMax: number): { from: IsoDate; to: IsoDate } {
  return { from: addDays(endDate, gapMin + 1), to: addDays(endDate, gapMax + 1) };
}

/** Free days between two legs; negative if they overlap. */
export function gapBetween(prevEnd: IsoDate, nextDeparture: IsoDate): number {
  return daysBetween(prevEnd, nextDeparture) - 1;
}

/**
 * Floors to integers, clamps to 0..MAX_GAP_DAYS and swaps if min > max.
 * If either value is not a finite number the result is DEFAULT_GAP.
 */
export function sanitiseGap(min: unknown, max: unknown): { min: number; max: number } {
  if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max)) {
    return { ...DEFAULT_GAP };
  }
  const clamp = (n: number) => Math.min(MAX_GAP_DAYS, Math.max(0, Math.floor(n)));
  const a = clamp(min);
  const b = clamp(max);
  return a <= b ? { min: a, max: b } : { min: b, max: a };
}

const hongKongDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Today's calendar date in Hong Kong, whatever the machine's timezone. */
export function todayInHongKong(now: Date = new Date()): IsoDate {
  const parts = hongKongDate.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
