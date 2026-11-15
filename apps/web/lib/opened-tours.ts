// The tours whose operator page the visitor opened from a card in this browser tab: kept in sessionStorage
// (this tab only, gone when the tab's session ends; nothing is sent anywhere), read only in the browser.
// With storage unavailable or failing, nothing is recorded and nothing is marked.

/** The sessionStorage entry: a JSON array of tour keys ('egl:KIX5'), oldest first, most recent last. */
export const OPENED_KEY = 'hktours.openedTours';
/** At most this many tours are kept; opening one more drops the oldest. */
export const OPENED_CAP = 100;

const NONE: readonly string[] = Object.freeze([]);
let cache: readonly string[] | null = null;
const listeners = new Set<() => void>();

function load(): readonly string[] {
  try {
    const raw = window.sessionStorage.getItem(OPENED_KEY);
    if (raw === null) return NONE;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return NONE;
    return parsed.filter((k): k is string => typeof k === 'string' && k !== '').slice(-OPENED_CAP);
  } catch {
    return NONE;
  }
}

/** The opened tours, oldest first. The same array until one is recorded (a stable snapshot for useSyncExternalStore). */
export function getOpenedTours(): readonly string[] {
  if (cache === null) cache = load();
  return cache;
}

/** For server rendering and hydration: the server cannot know, so nothing is marked there. */
export function getNoOpenedTours(): readonly string[] {
  return NONE;
}

/** Records that the tour's page was opened, as the most recent. Only once saved does it count (and show). */
export function recordOpened(key: string): void {
  const next = [...getOpenedTours().filter(k => k !== key), key].slice(-OPENED_CAP);
  try {
    window.sessionStorage.setItem(OPENED_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  cache = next;
  for (const listener of listeners) listener();
}

export function subscribeOpened(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Tests only: forget the in-memory copy, as a reload would. */
export function resetOpenedCache(): void {
  cache = null;
}
