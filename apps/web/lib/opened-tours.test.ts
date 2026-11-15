import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOpenedTours, OPENED_CAP, OPENED_KEY, recordOpened, resetOpenedCache, subscribeOpened } from './opened-tours';

beforeEach(() => { window.sessionStorage.clear(); resetOpenedCache(); });
afterEach(() => { vi.restoreAllMocks(); });

it('starts empty, and records tour keys oldest first, most recent last', () => {
  expect(getOpenedTours()).toEqual([]);
  recordOpened('egl:T1');
  recordOpened('jetour:T2');
  expect(getOpenedTours()).toEqual(['egl:T1', 'jetour:T2']);
  expect(JSON.parse(window.sessionStorage.getItem(OPENED_KEY)!)).toEqual(['egl:T1', 'jetour:T2']);
});

it('opening a tour again makes it the most recent, without a duplicate', () => {
  recordOpened('egl:T1');
  recordOpened('jetour:T2');
  recordOpened('egl:T1');
  expect(getOpenedTours()).toEqual(['jetour:T2', 'egl:T1']);
});

it('the stored key is session storage only, under one fixed name', () => {
  expect(OPENED_KEY).toBe('hktours.openedTours');
  recordOpened('egl:T1');
  expect(window.localStorage.length).toBe(0);
});

it(`keeps at most ${OPENED_CAP} tours, dropping the oldest`, () => {
  expect(OPENED_CAP).toBe(100);
  for (let i = 0; i < OPENED_CAP + 5; i++) recordOpened(`egl:T${i}`);
  const opened = getOpenedTours();
  expect(opened).toHaveLength(OPENED_CAP);
  expect(opened[0]).toBe('egl:T5');
  expect(opened.at(-1)).toBe(`egl:T${OPENED_CAP + 4}`);
});

it('reads what an earlier page in this tab stored (a reload, paging, coming back)', () => {
  window.sessionStorage.setItem(OPENED_KEY, JSON.stringify(['egl:T1', 'bigline:T3']));
  expect(getOpenedTours()).toEqual(['egl:T1', 'bigline:T3']);
});

it.each(['not json', '{"a":1}', '"egl:T1"', '[1, null, "egl:T1", ""]'])('ignores stored nonsense (%j): keeps only non-empty strings', raw => {
  window.sessionStorage.setItem(OPENED_KEY, raw);
  expect(getOpenedTours()).toEqual(raw.startsWith('[') ? ['egl:T1'] : []);
});

it('returns the same array until something changes (a stable snapshot for React)', () => {
  const a = getOpenedTours();
  expect(getOpenedTours()).toBe(a);
  recordOpened('egl:T1');
  expect(getOpenedTours()).not.toBe(a);
});

it('tells subscribers when a tour is recorded, until they unsubscribe', () => {
  const listener = vi.fn();
  const unsubscribe = subscribeOpened(listener);
  recordOpened('egl:T1');
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  recordOpened('egl:T2');
  expect(listener).toHaveBeenCalledTimes(1);
});

it('with storage blocked (reading throws): nothing is marked and nothing throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
  expect(getOpenedTours()).toEqual([]);
  expect(() => recordOpened('egl:T1')).not.toThrow();
  expect(getOpenedTours()).toEqual([]);
});

it('when saving fails (storage full or blocked for writing): no mark, as if storage were unavailable', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
  const listener = vi.fn();
  subscribeOpened(listener);
  recordOpened('egl:T1');
  expect(getOpenedTours()).toEqual([]);
  expect(listener).not.toHaveBeenCalled();
});

it('with no sessionStorage at all (the accessor itself throws)', () => {
  vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
  expect(getOpenedTours()).toEqual([]);
  expect(() => recordOpened('egl:T1')).not.toThrow();
});
