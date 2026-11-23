'use client';

import { useEffect, useRef, type SyntheticEvent } from 'react';

// The routes the visitor opened with 全部 N 站 on a page (task 76), so that coming back to the page with Back after
// leaving for an operator's page in the same tab shows them open again, as they were. Kept for this tab only
// (sessionStorage), by the page's address (path and query: the list page and its filters), at most MAX_PAGES pages.
// A page restored whole from the back/forward cache needs none of this: it comes back as it was.

export const OPEN_ROUTES_KEY = 'hktours.openRoutes';
const MAX_PAGES = 20;

type OpenRoutes = Record<string, string[]>;

const page = () => `${window.location.pathname}${window.location.search}`;

function read(): OpenRoutes {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(OPEN_ROUTES_KEY) ?? '{}');
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as OpenRoutes : {};
  } catch {
    return {};
  }
}

/** Whether the route with this key was left open on this page. */
export function isRouteOpen(key: string): boolean {
  const keys = read()[page()];
  return Array.isArray(keys) && keys.includes(key);
}

/** Records the route with this key as open or closed on this page (nothing, where the browser keeps nothing). */
export function rememberRouteOpen(key: string, open: boolean): void {
  const all = read();
  const here = page();
  const keys = new Set(Array.isArray(all[here]) ? all[here] : []);
  if (open === keys.has(key)) return;
  if (open) keys.add(key); else keys.delete(key);
  // The page just changed goes last: the oldest pages are the first dropped.
  delete all[here];
  if (keys.size > 0) all[here] = [...keys];
  const pages = Object.keys(all);
  for (const old of pages.slice(0, Math.max(pages.length - MAX_PAGES, 0))) delete all[old];
  try {
    window.sessionStorage.setItem(OPEN_ROUTES_KEY, JSON.stringify(all));
  } catch {
    // Storage blocked or full: the route simply is not reopened on return.
  }
}

/**
 * For a route's 全部 N 站 disclosure (`<details>`): reopens it after hydration when it was left open on this page, and
 * records each opening and closing. Opened after hydration, it may change the height above the window: the browser's
 * scroll anchoring keeps what the visitor sees in place.
 */
export function useRouteDisclosure(key: string) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current && isRouteOpen(key)) ref.current.open = true;
  }, [key]);
  return { ref, onToggle: (event: SyntheticEvent<HTMLDetailsElement>) => rememberRouteOpen(key, event.currentTarget.open) };
}
