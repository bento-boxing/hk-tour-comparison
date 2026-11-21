import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getNoSavedTours, getSavedTours, newestFirst, resetSavedCache, saveTour, subscribeSaved, unsaveTour,
  SAVED_KEY, SAVED_LABEL_MAX, SAVED_LABEL_WORD_MAX,
} from './saved-tours';
import { SAVED_CAP } from './saved-list';

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); resetSavedCache(); });
afterEach(() => { vi.restoreAllMocks(); });

const stored = () => JSON.parse(window.localStorage.getItem(SAVED_KEY)!);
const keys = () => getSavedTours().tours.map(t => t.key);

it('starts empty; saving keeps each tour\'s key and the time it was saved, oldest first, in localStorage', () => {
  expect(getSavedTours()).toEqual({ available: true, tours: [] });
  expect(saveTour('egl:T1', { now: 1000 })).toBe(true);
  expect(saveTour('jetour:T2', { now: 2000 })).toBe(true);
  expect(getSavedTours().tours).toEqual([{ key: 'egl:T1', savedAt: 1000 }, { key: 'jetour:T2', savedAt: 2000 }]);
  expect(stored()).toEqual([{ key: 'egl:T1', savedAt: 1000 }, { key: 'jetour:T2', savedAt: 2000 }]);
  // Under one fixed name, and nothing in the tab's sessionStorage (that is the opened tours').
  expect(SAVED_KEY).toBe('hktours.savedTours');
  expect(window.sessionStorage.length).toBe(0);
  // One entry, nothing else.
  expect(window.localStorage.length).toBe(1);
});

it('the saved page lists them newest first', () => {
  saveTour('egl:T1', { now: 1000 });
  saveTour('jetour:T2', { now: 2000 });
  saveTour('bigline:T3', { now: 3000 });
  expect(newestFirst(getSavedTours())).toEqual(['bigline:T3', 'jetour:T2', 'egl:T1']);
});

it('saving a saved tour again changes nothing (it keeps its first time); removing takes it out', () => {
  saveTour('egl:T1', { now: 1000 });
  saveTour('jetour:T2', { now: 2000 });
  expect(saveTour('egl:T1', { now: 5000 })).toBe(true);
  expect(getSavedTours().tours).toEqual([{ key: 'egl:T1', savedAt: 1000 }, { key: 'jetour:T2', savedAt: 2000 }]);
  expect(unsaveTour('egl:T1')).toBe(true);
  expect(keys()).toEqual(['jetour:T2']);
  expect(stored()).toEqual([{ key: 'jetour:T2', savedAt: 2000 }]);
  expect(unsaveTour('egl:NEVER')).toBe(true);
  expect(keys()).toEqual(['jetour:T2']);
});

it(`keeps at most ${SAVED_CAP} tours: saving one more drops the oldest`, () => {
  expect(SAVED_CAP).toBe(100);
  for (let i = 0; i < SAVED_CAP + 3; i++) saveTour(`egl:T${i}`, { now: i });
  expect(keys()).toHaveLength(SAVED_CAP);
  expect(keys()[0]).toBe('egl:T3');
  expect(keys().at(-1)).toBe(`egl:T${SAVED_CAP + 2}`);
  expect(stored()).toHaveLength(SAVED_CAP);
});

it('only a real tour key is saved', () => {
  for (const key of ['', 'garbage', 'nobody:T1', 'egl:has space', '__proto__']) expect(saveTour(key), key).toBe(false);
  expect(window.localStorage.getItem(SAVED_KEY)).toBeNull();
});

it('reads what was saved before: another page, a reload, another day', () => {
  window.localStorage.setItem(SAVED_KEY, JSON.stringify([{ key: 'egl:T1', savedAt: 1 }, { key: 'bigline:T3', savedAt: 2 }]));
  expect(keys()).toEqual(['egl:T1', 'bigline:T3']);
});

it.each([
  ['not json', []],
  ['{"key":"egl:T1","savedAt":1}', []],
  ['"egl:T1"', []],
  ['[null, 1, "egl:T1", {"key":"egl:T1"}, {"key":"nobody:T2","savedAt":2}, {"key":"egl:T3","savedAt":"3"}, {"key":"egl:T4","savedAt":4}]', ['egl:T4']],
  ['[{"key":"egl:T1","savedAt":1},{"key":"egl:T1","savedAt":2}]', ['egl:T1']],
])('ignores stored nonsense (%s): keeps only valid entries, each key once', (raw, expected) => {
  window.localStorage.setItem(SAVED_KEY, raw);
  expect(keys()).toEqual(expected);
});

it(`a stored list longer than ${SAVED_CAP} (edited by hand) is read as its newest ${SAVED_CAP}`, () => {
  window.localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from({ length: SAVED_CAP + 5 }, (_, i) => ({ key: `egl:T${i}`, savedAt: i }))));
  expect(keys()).toHaveLength(SAVED_CAP);
  expect(keys()[0]).toBe('egl:T5');
});

it('returns the same snapshot until something changes (a stable snapshot for React); the server\'s is null', () => {
  const a = getSavedTours();
  expect(getSavedTours()).toBe(a);
  saveTour('egl:T1');
  expect(getSavedTours()).not.toBe(a);
  expect(getNoSavedTours()).toBeNull();
});

it('tells subscribers of every change, until they unsubscribe', () => {
  const listener = vi.fn();
  const unsubscribe = subscribeSaved(listener);
  saveTour('egl:T1');
  unsaveTour('egl:T1');
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
  saveTour('egl:T2');
  expect(listener).toHaveBeenCalledTimes(2);
});

it('kept in step across tabs: a change another tab makes (the storage event) is read and announced', () => {
  saveTour('egl:T1', { now: 1 });
  const listener = vi.fn();
  const unsubscribe = subscribeSaved(listener);
  // Another tab writes the list; this tab hears of it through the storage event.
  window.localStorage.setItem(SAVED_KEY, JSON.stringify([{ key: 'egl:T1', savedAt: 1 }, { key: 'jetour:T2', savedAt: 2 }]));
  window.dispatchEvent(new StorageEvent('storage', { key: SAVED_KEY }));
  expect(listener).toHaveBeenCalledTimes(1);
  expect(keys()).toEqual(['egl:T1', 'jetour:T2']);
  // The site's storage cleared in another tab (key null).
  window.localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
  expect(keys()).toEqual([]);
  // Another entry (the opened tours are in sessionStorage, but any other key) is not this list.
  window.dispatchEvent(new StorageEvent('storage', { key: 'something.else' }));
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
  window.dispatchEvent(new StorageEvent('storage', { key: SAVED_KEY }));
  expect(listener).toHaveBeenCalledTimes(2);
});

it('a save reads storage afresh, so a tour saved in another tab a moment ago is kept', () => {
  saveTour('egl:T1', { now: 1 });
  // Another tab saved T2; this tab has not heard yet.
  window.localStorage.setItem(SAVED_KEY, JSON.stringify([{ key: 'egl:T1', savedAt: 1 }, { key: 'jetour:T2', savedAt: 2 }]));
  saveTour('bigline:T3', { now: 3 });
  expect(stored().map((t: { key: string }) => t.key)).toEqual(['egl:T1', 'jetour:T2', 'bigline:T3']);
});

it('storage blocked (reading throws): unavailable, nothing saved, nothing throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
  expect(getSavedTours()).toEqual({ available: false, tours: [] });
  expect(() => saveTour('egl:T1')).not.toThrow();
  expect(saveTour('egl:T1')).toBe(false);
  expect(getSavedTours().available).toBe(false);
});

it('no localStorage at all (the accessor itself throws, as with site data blocked)', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
  expect(getSavedTours().available).toBe(false);
  expect(() => saveTour('egl:T1')).not.toThrow();
  expect(() => unsaveTour('egl:T1')).not.toThrow();
});

it('a browser with no room at all (a quota of 0): the list is still read and shown; saving fails and says so', () => {
  window.localStorage.setItem(SAVED_KEY, JSON.stringify([{ key: 'egl:T1', savedAt: 1 }]));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
  expect(getSavedTours()).toEqual({ available: true, tours: [{ key: 'egl:T1', savedAt: 1 }] });
  expect(saveTour('jetour:T2', { now: 2 })).toBe(false);
  expect(getSavedTours()).toEqual({ available: true, tours: [{ key: 'egl:T1', savedAt: 1 }] });
});

it('storage full when saving: the list stays as it was (still shown and counted), and saving reports it failed', () => {
  saveTour('egl:T1', { now: 1 });
  const listener = vi.fn();
  subscribeSaved(listener);
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
  expect(saveTour('jetour:T2', { now: 2 })).toBe(false);
  expect(getSavedTours()).toEqual({ available: true, tours: [{ key: 'egl:T1', savedAt: 1 }] });
  expect(listener).toHaveBeenCalled(); // so a button that pressed can say it failed
  // Removing fails the same way and changes nothing; once there is room again, it works.
  expect(unsaveTour('egl:T1')).toBe(false);
  expect(keys()).toEqual(['egl:T1']);
  setItem.mockRestore();
  expect(unsaveTour('egl:T1')).toBe(true);
  expect(keys()).toEqual([]);
});

it('keeps each tour\'s label (the site\'s own text, for a tour that is no longer listed), cleaned and bounded', () => {
  saveTour('egl:T1', { label: '  東瀛遊：大阪、京都，5日4夜 ', now: 1 });
  saveTour('egl:T2', { label: 'a\u0000b\nc', now: 2 });
  saveTour('egl:T3', { label: 'x'.repeat(SAVED_LABEL_MAX + 1), now: 3 });
  saveTour('egl:T4', { now: 4 });
  expect(getSavedTours().tours).toEqual([
    { key: 'egl:T1', savedAt: 1, label: '東瀛遊：大阪、京都，5日4夜' },
    { key: 'egl:T2', savedAt: 2, label: 'a b c' },
    { key: 'egl:T3', savedAt: 3 },
    { key: 'egl:T4', savedAt: 4 },
  ]);
  // A run of letters no line could break (it would scroll a phone sideways) is not kept; the longest place name is.
  resetSavedCache();
  window.localStorage.clear();
  saveTour('egl:T5', { label: `EGL Tours: ${'X'.repeat(SAVED_LABEL_WORD_MAX + 1)}, 5 days`, now: 5 });
  saveTour('egl:T6', { label: 'EGL Tours: Amanohashidate, Garmisch-Partenkirchen, 5 days, 4 nights', now: 6 });
  saveTour('egl:T7', { label: `東瀛遊：${'大阪、京都、'.repeat(30)}5日4夜`, now: 7 });
  expect(getSavedTours().tours.map(t => t.label)).toEqual([
    undefined, 'EGL Tours: Amanohashidate, Garmisch-Partenkirchen, 5 days, 4 nights', `東瀛遊：${'大阪、京都、'.repeat(30)}5日4夜`,
  ]);
  // A label edited by hand into something else is dropped; the tour stays.
  window.localStorage.setItem(SAVED_KEY, JSON.stringify([{ key: 'egl:T1', savedAt: 1, label: { html: '<b>' } }, { key: 'egl:T2', savedAt: 2, label: '' }]));
  resetSavedCache();
  expect(getSavedTours().tours).toEqual([{ key: 'egl:T1', savedAt: 1 }, { key: 'egl:T2', savedAt: 2 }]);
});
