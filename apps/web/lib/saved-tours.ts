import { isTourKey, SAVED_CAP } from './saved-list';

// The tours the visitor saved (收藏), kept in this browser's localStorage only: nothing is sent anywhere when a tour
// is saved, and there are no accounts. localStorage, not the sessionStorage of lib/opened-tours.ts, so the list lasts
// beyond the tab and is shared by every tab of the site; a change in one tab reaches the others through the browser's
// `storage` event. Read only in the browser: the server renders as if nothing were saved, and the marks and the count
// appear after hydration (useSyncExternalStore with getNoSavedTours). The list leaves the browser only when the
// visitor opens the saved page, which puts it in its own address to have the server show those tours.
//
// Two ways storage can fail:
//  - it cannot be read at all (site data blocked: the accessor or the read throws): the list is unavailable, nothing
//    is shown as saved, the save buttons are not shown and the saved page says why;
//  - a write fails (storage full, or a browser with no room at all): the list stays as it was and is still shown,
//    counted and removable where removing works; saveTour / unsaveTour return false, and the button says so.

/** The localStorage entry: a JSON array of { key, savedAt, label } (savedAt in ms since 1970), oldest first. */
export const SAVED_KEY = 'hktours.savedTours';
/** A label longer than this is not kept (the site's own are shorter: a 20-stop English route is about 250). */
export const SAVED_LABEL_MAX = 400;
/**
 * A label with an unbroken run of more characters than this (a line can break at a space, a hyphen or in Chinese text,
 * never inside a word) is not kept: 16 of the widest letter (W) still fit a 320px phone's line; the longest run in the
 * site's place names is 14 (Amanohashidate; Garmisch-Partenkirchen breaks at its hyphen).
 */
export const SAVED_LABEL_WORD_MAX = 16;

/**
 * A saved tour: its key, when it was saved and, from the saving row, a short label made only from the site's own data
 * (the operator's name, the places, the length: '東瀛遊：大阪、京都，5日4夜'), shown if the tour is ever no longer listed.
 */
export interface SavedTour { key: string; savedAt: number; label?: string }
/** What the browser holds: whether the list can be read at all, and the saved tours, oldest first. */
export interface SavedTours { available: boolean; tours: readonly SavedTour[] }

const UNAVAILABLE: SavedTours = Object.freeze({ available: false, tours: Object.freeze([]) });
let cache: SavedTours | null = null;
const listeners = new Set<() => void>();

/**
 * A label as kept: text without control characters, trimmed, 1 to SAVED_LABEL_MAX characters, and no run of more than
 * SAVED_LABEL_WORD_MAX characters that a line cannot break inside (anything but spaces, hyphens and CJK); otherwise
 * none.
 */
function cleanLabel(label: unknown): string | undefined {
  if (typeof label !== 'string') return undefined;
  const text = label.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  const unbreakable = new RegExp(`[^\\s\\u2e80-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef、，：-]{${SAVED_LABEL_WORD_MAX + 1},}`);
  return text !== '' && text.length <= SAVED_LABEL_MAX && !unbreakable.test(text) ? text : undefined;
}

/** The stored list, cleaned: valid keys with a time, each key once (its first saving), the newest SAVED_CAP. */
function parse(raw: string | null): readonly SavedTour[] {
  if (raw === null) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const tours: SavedTour[] = [];
  for (const entry of parsed) {
    const { key, savedAt, label } = (entry ?? {}) as Partial<SavedTour>;
    if (!isTourKey(key) || typeof savedAt !== 'number' || !Number.isFinite(savedAt)) continue;
    if (tours.some(t => t.key === key)) continue;
    const kept = cleanLabel(label);
    tours.push(kept === undefined ? { key, savedAt } : { key, savedAt, label: kept });
  }
  return tours.slice(-SAVED_CAP);
}

/** The list as stored now; unavailable when storage cannot be read at all. */
function load(): SavedTours {
  try {
    return { available: true, tours: parse(window.localStorage.getItem(SAVED_KEY)) };
  } catch {
    return UNAVAILABLE;
  }
}

function notify() {
  for (const listener of listeners) listener();
}

/** What is saved now. The same object until something changes (a stable snapshot for useSyncExternalStore). */
export function getSavedTours(): SavedTours {
  if (cache === null) cache = load();
  return cache;
}

/** For server rendering and hydration: the server cannot know, so it renders as if nothing were saved. */
export function getNoSavedTours(): null {
  return null;
}

/** The saved keys, newest saved first (the saved page's order). */
export function newestFirst(saved: SavedTours): string[] {
  return saved.tours.map(t => t.key).reverse();
}

/**
 * Writes the list. When the write fails (storage full), nothing changes: the list as read is what is shown, and the
 * caller learns it failed.
 */
function write(current: SavedTours, tours: readonly SavedTour[]): boolean {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(tours));
  } catch {
    cache = current;
    notify();
    return false;
  }
  cache = { available: true, tours };
  notify();
  return true;
}

/**
 * Saves the tour as the newest, with its label, unless it is saved already. More than SAVED_CAP drops the oldest.
 * Read afresh from storage first, so a save in another tab a moment ago is kept. False when nothing was saved
 * (storage unavailable or full, or not a tour key).
 */
export function saveTour(key: string, { label, now = Date.now() }: { label?: string; now?: number } = {}): boolean {
  if (!isTourKey(key)) return false;
  const current = load();
  if (!current.available) {
    cache = current;
    notify();
    return false;
  }
  if (current.tours.some(t => t.key === key)) {
    cache = current;
    notify();
    return true;
  }
  const kept = cleanLabel(label);
  const entry: SavedTour = kept === undefined ? { key, savedAt: now } : { key, savedAt: now, label: kept };
  return write(current, [...current.tours, entry].slice(-SAVED_CAP));
}

/** Removes the tour from the list (read afresh from storage first, as saveTour). False when the write failed. */
export function unsaveTour(key: string): boolean {
  const current = load();
  if (!current.available) {
    cache = current;
    notify();
    return false;
  }
  return write(current, current.tours.filter(t => t.key !== key));
}

/** Another tab changed the list (or cleared the site's storage): read it again. */
function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== SAVED_KEY) return;
  cache = null;
  notify();
}

/** Subscribes to changes here and in the site's other tabs. */
export function subscribeSaved(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/** Tests only: forget the in-memory copy, as a reload would. */
export function resetSavedCache(): void {
  cache = null;
}
