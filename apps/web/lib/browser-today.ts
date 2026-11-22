import { useSyncExternalStore } from 'react';
import { addDays, isIsoDate, todayInHongKong, type IsoDate } from '@hktours/core';

// Hong Kong's today by this browser's clock, read only in the browser, after hydration. A page carries the server's
// today from when it was made; the home page is a stored copy (refreshed hourly, and the first visitor after that
// still gets the old one; a copy can be days old when nightly runs fail), so after Hong Kong's midnight it can still
// offer departures dated the new today or before, which the chain page then drops. The rows hide those with the
// browser's date (useUpcomingAfter).

/** How often an open page checks whether Hong Kong's date has changed, in ms. */
const CHECK_MS = 60_000;
/** The most days the browser's date may be after the page's and still be used; further ahead, the clock is taken as wrong. */
export const MAX_DAYS_AHEAD = 7;

let clock: () => Date = () => new Date();
let cache: IsoDate | null = null;
/** The latest date the rows have used in this page view: they never go back to an earlier one (see useUpcomingAfter). */
let floor: IsoDate | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

/** Reads the clock; the date only ever moves on in a page view (a clock set back keeps the later date). */
function read(): boolean {
  const next = todayInHongKong(clock());
  if (cache !== null && next <= cache) return false;
  cache = next;
  return true;
}

function check(): void {
  if (read()) for (const listener of listeners) listener();
}

/** Hong Kong's today by this browser's clock. The same string until Hong Kong's date changes. */
export function getBrowserToday(): IsoDate {
  if (cache === null) read();
  return cache!;
}

/** For server rendering and hydration: the server's today is the page's own (the server HTML stays as stored). */
export function getNoBrowserToday(): null {
  return null;
}

/**
 * Told when Hong Kong's date changes: checked at once when the first row appears (the date may have been read on an
 * earlier page, before a midnight, with no row to keep it fresh since), then every minute, and when the tab is shown
 * again (a hidden tab may run no timers).
 */
export function subscribeBrowserToday(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(check, CHECK_MS);
    document.addEventListener('visibilitychange', check);
    if (cache !== null) check(); // nothing read yet: nothing can be stale
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', check);
  };
}

/**
 * The date after which departures are still to come: the browser's when it is 1 to MAX_DAYS_AHEAD days after the
 * page's today (a copy made before one or more Hong Kong midnights, seen after them), else the page's. A browser date
 * behind the page's, or further ahead, is taken as the browser's clock being wrong, and the page's date stands; so does
 * any unusable date.
 */
export function upcomingAfter(pageToday: IsoDate, browserToday: IsoDate | null): IsoDate {
  if (browserToday === null || !isIsoDate(pageToday) || !isIsoDate(browserToday)) return pageToday;
  return browserToday > pageToday && browserToday <= addDays(pageToday, MAX_DAYS_AHEAD) ? browserToday : pageToday;
}

/**
 * upcomingAfter with this browser's date: the page's today on the server and while hydrating; then the browser's, by
 * that rule. A date once used is never given up in this page view, so hidden dates never come back: not when the
 * browser's date passes MAX_DAYS_AHEAD on a tab left open, not when the clock is set back, not on the next page.
 * (Every date it keeps came from the rule, for this page or one before it; keeping the latest is the same answer for any
 * render, so remembering it here is safe.)
 */
export function useUpcomingAfter(pageToday: IsoDate): IsoDate {
  const browserToday = useSyncExternalStore(subscribeBrowserToday, getBrowserToday, getNoBrowserToday);
  const ruled = upcomingAfter(pageToday, browserToday);
  if (browserToday === null || !isIsoDate(ruled)) return ruled;
  if (floor === null || ruled > floor) floor = ruled;
  return floor;
}

/** Tests only: forget the date read and the date used, as a reload would. */
export function resetBrowserTodayCache(): void {
  cache = null;
  floor = null;
}

/** Tests only: the clock the browser's date is read from (null: the real one). */
export function setBrowserTodayClockForTests(now: (() => Date) | null): void {
  clock = now ?? (() => new Date());
}
