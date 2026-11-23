import { it, expect, beforeEach } from 'vitest';
import { isRouteOpen, OPEN_ROUTES_KEY, rememberRouteOpen } from './open-routes';

beforeEach(() => { window.sessionStorage.clear(); window.history.replaceState(null, '', '/tours/japan?days=4-6'); });

it('remembers the routes left open on a page, by its address (path and query), for this tab', () => {
  rememberRouteOpen('egl:KIX5', true);
  rememberRouteOpen('jetour:THB', true);
  expect(isRouteOpen('egl:KIX5')).toBe(true);
  expect(JSON.parse(window.sessionStorage.getItem(OPEN_ROUTES_KEY)!)).toEqual({ '/tours/japan?days=4-6': ['egl:KIX5', 'jetour:THB'] });
  // Another page, or the same page with other filters: its own.
  window.history.replaceState(null, '', '/tours/japan?days=7-9');
  expect(isRouteOpen('egl:KIX5')).toBe(false);
  window.history.replaceState(null, '', '/tours/japan?days=4-6');
  rememberRouteOpen('egl:KIX5', false);
  expect(isRouteOpen('egl:KIX5')).toBe(false);
  expect(isRouteOpen('jetour:THB')).toBe(true);
});

it('keeps the 20 pages changed last; storage that is blocked or holds rubbish changes nothing and throws nothing', () => {
  for (let i = 0; i < 25; i++) {
    window.history.replaceState(null, '', `/tours/japan?page=${i}`);
    rememberRouteOpen('egl:KIX5', true);
  }
  expect(Object.keys(JSON.parse(window.sessionStorage.getItem(OPEN_ROUTES_KEY)!))).toHaveLength(20);
  window.sessionStorage.setItem(OPEN_ROUTES_KEY, '[1,2');
  expect(isRouteOpen('egl:KIX5')).toBe(false);
  rememberRouteOpen('egl:KIX5', true);
  expect(isRouteOpen('egl:KIX5')).toBe(true);
});
