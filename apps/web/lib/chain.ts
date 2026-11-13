import { daysBetween, gapBetween, gapWindow, isIsoDate, sanitiseGap, tourEndDate, type ChainState, type IsoDate } from '@hktours/core';
import type { TourCardData } from '@hktours/db/read';

// The chain page's arithmetic. Pure, and never throws: the core date helpers throw RangeError on a bad
// date, so every date is checked with isIsoDate before it reaches them, and anything unusable counts as
// an invalid leg.

export interface ResolvedLeg {
  tour: TourCardData; departure: IsoDate; endDate: IsoDate;
  priceHkd: number; priceIsExact: boolean;  // exact when that departure has its own price
  gapBefore: number | null;                 // free days since the previous leg; null for the first
}
export interface ResolvedChain { legs: ResolvedLeg[]; droppedCount: number }

export interface ChainTotals { priceHkd: number; priceIsExact: boolean; tourDays: number; spanDays: number }

const isPrice = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const isTourLength = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1;

/** The tour's last day, or null when the departure or length is unusable or the end falls off the calendar. */
function safeEndDate(departure: unknown, days: unknown): IsoDate | null {
  if (typeof departure !== 'string' || !isIsoDate(departure) || !isTourLength(days)) return null;
  try {
    const end = tourEndDate(departure, days);
    return isIsoDate(end) ? end : null;
  } catch {
    return null; // a length so large that the date is out of range
  }
}

/**
 * The legs of the chain that are still valid, in order. A leg is valid when its tour is in `tours`
 * (exists and is active), its departure is one of that tour's departures from `today` on, and it departs
 * after the previous leg ends. The first invalid leg and every leg after it are dropped.
 * The price is that departure's own price, or the tour's stored fallback price (not exact) when it has none.
 */
export function resolveChain(state: ChainState, tours: Map<string, TourCardData>, today: IsoDate): ResolvedChain {
  const refs = Array.isArray(state?.legs) ? state.legs : [];
  const legs: ResolvedLeg[] = [];
  const todayOk = typeof today === 'string' && isIsoDate(today);

  for (const ref of refs) {
    const tour = typeof ref?.tourKey === 'string' ? tours.get(ref.tourKey) : undefined;
    const departure = ref?.departure;
    if (!tour || !todayOk || typeof departure !== 'string' || !isIsoDate(departure) || departure < today) break;

    const offered = Array.isArray(tour.departures) ? tour.departures.find(d => d.date === departure) : undefined;
    if (!offered) break;

    const endDate = safeEndDate(departure, tour.days);
    if (endDate === null) break;

    const previous = legs.at(-1);
    const gapBefore = previous ? gapBetween(previous.endDate, departure) : null;
    if (gapBefore !== null && gapBefore < 0) break;

    const own = offered.priceHkd;
    const exact = isPrice(own);
    const priceHkd = exact ? own : tour.fallbackPriceHkd;
    if (!isPrice(priceHkd)) break;

    legs.push({ tour, departure, endDate, priceHkd, priceIsExact: exact, gapBefore });
  }
  return { legs, droppedCount: refs.length - legs.length };
}

/** The legs up to the first one whose dates, length or price are unusable. */
function usableLegs(legs: ResolvedLeg[]): ResolvedLeg[] {
  if (!Array.isArray(legs)) return [];
  const result: ResolvedLeg[] = [];
  for (const leg of legs) {
    const ok = leg != null
      && typeof leg.departure === 'string' && isIsoDate(leg.departure)
      && typeof leg.endDate === 'string' && isIsoDate(leg.endDate)
      && isPrice(leg.priceHkd) && isTourLength(leg.tour?.days);
    if (!ok) break;
    result.push(leg);
  }
  return result;
}

/**
 * Sum of prices (exact only if every leg is), sum of tour lengths, and the days from the first departure
 * to the last end date, inclusive. All zeros, and exact, for no legs.
 */
export function chainTotals(legs: ResolvedLeg[]): ChainTotals {
  const usable = usableLegs(legs);
  const first = usable[0];
  const last = usable.at(-1);
  if (!first || !last) return { priceHkd: 0, priceIsExact: true, tourDays: 0, spanDays: 0 };
  return {
    priceHkd: usable.reduce((sum, l) => sum + l.priceHkd, 0),
    priceIsExact: usable.every(l => l.priceIsExact),
    tourDays: usable.reduce((sum, l) => sum + l.tour.days, 0),
    spanDays: daysBetween(first.departure, last.endDate) + 1,
  };
}

/** The departure window for the next leg, or null when there are no legs. */
export function nextWindow(legs: ResolvedLeg[], gap: { min: number; max: number }): { from: IsoDate; to: IsoDate } | null {
  const last = usableLegs(legs).at(-1);
  if (!last) return null;
  const { min, max } = sanitiseGap(gap?.min, gap?.max);
  const window = gapWindow(last.endDate, min, max);
  // Past year 9999 the dates stop being YYYY-MM-DD; there is no window then rather than a broken one.
  return isIsoDate(window.from) && isIsoDate(window.to) ? window : null;
}

/** The fewest and most free days between a leg ending on `endDate` and these departures; null when none is usable. */
export function restRange(endDate: IsoDate, departures: IsoDate[]): { min: number; max: number } | null {
  if (typeof endDate !== 'string' || !isIsoDate(endDate)) return null;
  const gaps = departures.filter(d => typeof d === 'string' && isIsoDate(d)).map(d => gapBetween(endDate, d));
  if (gaps.length === 0) return null;
  return { min: Math.min(...gaps), max: Math.max(...gaps) };
}
