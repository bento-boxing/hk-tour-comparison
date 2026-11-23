import { it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { useOperatorLinkTarget } from './link-target';
import { PHONE_MEDIA } from './breakpoints';

/** A window whose width matches the phone layout or not, and which can change. */
function stubWidth(phone: boolean) {
  const listeners = new Set<() => void>();
  const query = { matches: phone, addEventListener: (_: string, l: () => void) => listeners.add(l), removeEventListener: (_: string, l: () => void) => listeners.delete(l) };
  window.matchMedia = vi.fn().mockReturnValue(query) as unknown as typeof window.matchMedia;
  return { set: (next: boolean) => { query.matches = next; listeners.forEach(l => l()); } };
}
afterEach(() => { delete (window as Partial<Window>).matchMedia; });

it('on the phone layout no target (this tab, so Back returns to the site); on the wide one a new tab; it follows the width', () => {
  const width = stubWidth(true);
  const { result } = renderHook(() => useOperatorLinkTarget());
  expect(window.matchMedia).toHaveBeenCalledWith(PHONE_MEDIA);
  expect(result.current).toBeUndefined();
  act(() => width.set(false));
  expect(result.current).toBe('_blank');
  act(() => width.set(true));
  expect(result.current).toBeUndefined();
});

it('the server (and a browser without JavaScript) gets a new tab, as before: it cannot know the width', () => {
  stubWidth(true);
  function Link() { return createElement('a', { href: 'https://example.test/', target: useOperatorLinkTarget() }); }
  expect(renderToString(createElement(Link))).toContain('target="_blank"');
});

it('a browser without matchMedia: a new tab', () => {
  const { result } = renderHook(() => useOperatorLinkTarget());
  expect(result.current).toBe('_blank');
});
