import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  getBrowserToday, getNoBrowserToday, resetBrowserTodayCache, setBrowserTodayClockForTests, subscribeBrowserToday, upcomingAfter,
} from './browser-today';

// The tests set (vitest.setup.ts) a browser clock from 2000, so no other test depends on today's date; these use the real
// clock, under fake timers.
beforeEach(() => { setBrowserTodayClockForTests(null); resetBrowserTodayCache(); });
afterEach(() => { vi.useRealTimers(); });

it('upcomingAfter: the browser\'s date when it is 1 to 7 days after the page\'s, else the page\'s', () => {
  expect(upcomingAfter('2026-11-22', null)).toBe('2026-11-22'); // the server, and while hydrating
  expect(upcomingAfter('2026-11-22', '2026-11-22')).toBe('2026-11-22');
  expect(upcomingAfter('2026-11-22', '2026-11-23')).toBe('2026-11-23'); // made before midnight, seen after it
  expect(upcomingAfter('2026-11-22', '2026-11-24')).toBe('2026-11-24'); // a copy two days old
  expect(upcomingAfter('2026-11-22', '2026-11-29')).toBe('2026-11-29'); // a week old
  expect(upcomingAfter('2026-12-31', '2027-01-01')).toBe('2027-01-01');
  // A browser clock behind the page's, or more than a week ahead of it, is taken as wrong: the page's date stands.
  expect(upcomingAfter('2026-11-22', '2026-11-21')).toBe('2026-11-22');
  expect(upcomingAfter('2026-11-22', '2026-11-30')).toBe('2026-11-22');
  expect(upcomingAfter('2026-11-22', '2027-11-22')).toBe('2026-11-22');
  // Unusable dates change nothing.
  expect(upcomingAfter('garbage', '2026-11-23')).toBe('garbage');
  expect(upcomingAfter('2026-11-22', 'garbage')).toBe('2026-11-22');
});

it('the browser\'s date never goes back in a page view: a clock set back later keeps the later date', () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-11-22T16:20:00Z')); // 00:20 on 23 Nov in Hong Kong
  const off = subscribeBrowserToday(() => {});
  try {
    expect(getBrowserToday()).toBe('2026-11-23');
    vi.setSystemTime(new Date('2026-11-22T10:00:00Z')); // corrected back to 18:00 on 22 Nov
    vi.advanceTimersByTime(60_000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(getBrowserToday()).toBe('2026-11-23');
  } finally { off(); }
});

it('the browser\'s today is Hong Kong\'s, from this browser\'s clock; the server has none', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-22T15:59:59Z')); // 23:59:59 in Hong Kong
  expect(getBrowserToday()).toBe('2026-11-22');
  expect(getNoBrowserToday()).toBeNull();
  resetBrowserTodayCache();
  vi.setSystemTime(new Date('2026-11-22T16:00:00Z')); // midnight in Hong Kong, 4 pm in London
  expect(getBrowserToday()).toBe('2026-11-23');
});

it('an open page learns of Hong Kong\'s midnight within a minute, and when its tab is shown again; one timer for all rows', () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-11-22T15:59:30Z'));
  const a = vi.fn(), b = vi.fn();
  const offA = subscribeBrowserToday(a);
  const offB = subscribeBrowserToday(b);
  try {
    expect(getBrowserToday()).toBe('2026-11-22');
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(20_000); // 23:59:50: the same day, nobody is told
    expect(a).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000); // 00:00:50
    expect(getBrowserToday()).toBe('2026-11-23');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    // A tab in the background may run no timers for hours: shown again, it checks at once.
    vi.setSystemTime(new Date('2026-11-23T16:10:00Z'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(getBrowserToday()).toBe('2026-11-24');
    expect(a).toHaveBeenCalledTimes(2);
  } finally { offA(); offB(); }
  expect(vi.getTimerCount()).toBe(0);
  vi.setSystemTime(new Date('2026-11-24T16:10:00Z'));
  document.dispatchEvent(new Event('visibilitychange'));
  expect(a).toHaveBeenCalledTimes(2);
});

it('the first row to appear checks the date at once (back from a page without rows, the date read there may be old)', () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-11-22T15:50:00Z')); // 23:50 on 22 Nov: read, then no rows (no listener, no timer)
  expect(getBrowserToday()).toBe('2026-11-22');
  vi.setSystemTime(new Date('2026-11-22T16:20:00Z')); // 00:20 on 23 Nov
  const listener = vi.fn();
  const off = subscribeBrowserToday(listener);
  try {
    expect(getBrowserToday()).toBe('2026-11-23');
    expect(listener).toHaveBeenCalledTimes(1);
  } finally { off(); }
});
