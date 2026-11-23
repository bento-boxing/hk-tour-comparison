import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { NoCurrentTab, TabBar, tabFor } from './TabBar';
import { makeT } from '../lib/i18n';
import { resetSavedCache, saveTour, SAVED_KEY } from '../lib/saved-tours';
import { rememberTrip, resetTripCache, TRIP_KEY } from '../lib/remembered-trip';

const address = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => address.pathname }));
// next/link as a plain <a> that shows the prefetch setting it was given (data-prefetch).
vi.mock('next/link', () => ({
  default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean | null; children: React.ReactNode }) =>
    <a href={href} data-prefetch={prefetch === undefined ? 'default' : String(prefetch)} {...rest}>{children}</a>,
}));

const tZh = makeT('zh-Hant');
const css = () => readFileSync(join(__dirname, 'TabBar.module.css'), 'utf8').replace(/\s+/g, ' ');
const bar = () => screen.getByRole('navigation', { name: '主要頁面' });
beforeEach(() => { address.pathname = '/'; window.localStorage.clear(); resetSavedCache(); resetTripCache(); window.scrollY = 0; });
afterEach(() => { vi.restoreAllMocks(); });

/** Scrolls the window to `y` and lets the bar read it (it reads once a frame). */
function scrollTo(y: number) {
  window.scrollY = y;
  act(() => { fireEvent.scroll(window); });
  act(() => { vi.runOnlyPendingTimers(); });
}

it('three tabs, each a real link with an icon over its name: 搜尋, 連續行程 and 已收藏, in the page\'s language; none pre-loads its page', () => {
  for (const [locale, names, hrefs] of [
    ['zh-Hant', ['搜尋', '連續行程', '已收藏'], ['/', '/chain', '/saved']],
    ['zh-Hans', ['搜索', '连续行程', '已收藏'], ['/zh-hans', '/zh-hans/chain', '/zh-hans/saved']],
    ['en', ['Search', 'Plan a trip', 'Saved'], ['/en', '/en/chain', '/en/saved']],
  ] as const) {
    const { unmount } = render(<TabBar t={makeT(locale)} />);
    const links = screen.getAllByRole('link');
    expect(links.map(a => a.textContent)).toEqual(names);
    expect(links.map(a => a.getAttribute('href'))).toEqual(hrefs);
    for (const a of links) {
      expect(a).toHaveAttribute('data-prefetch', 'false');
      expect(a.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
    unmount();
  }
});

it('marks the current tab (aria-current="page"): destination, season, operator and search pages mark 搜尋; the indexes and the about page none', () => {
  expect(['/', '/q', '/tours/japan', '/seasons/christmas', '/operators/egl', '/en/tours/japan', '/zh-hans'].map(tabFor)).toEqual(Array(7).fill('search'));
  expect(['/chain', '/en/chain'].map(tabFor)).toEqual(['chain', 'chain']);
  expect(['/saved', '/zh-hans/saved'].map(tabFor)).toEqual(['saved', 'saved']);
  expect(['/tours', '/operators', '/about', '/en/about', '/nope'].map(tabFor)).toEqual(Array(5).fill(undefined));
  address.pathname = '/seasons/christmas';
  const { unmount } = render(<TabBar t={tZh} />);
  expect(screen.getAllByRole('link').map(a => a.getAttribute('aria-current'))).toEqual(['page', null, null]);
  unmount();
  address.pathname = '/en/saved';
  render(<TabBar t={makeT('en')} />);
  expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Saved');
});

it('badges: the tours saved in this browser and the tours in the trip it remembers, read out after the name; none for none', () => {
  const chain = { legs: [{ tourKey: 'egl:KIX5', departure: '2026-12-18' }, { tourKey: 'jetour:THB', departure: '2026-12-24' }, { tourKey: 'egl:B', departure: '2027-01-02' }], gap: { min: 1, max: 3 } };
  render(<TabBar t={tZh} />);
  expect(screen.getAllByRole('link').map(a => a.textContent)).toEqual(['搜尋', '連續行程', '已收藏']);
  act(() => { saveTour('egl:KIX5'); saveTour('jetour:THB'); rememberTrip(chain); });
  expect(screen.getByRole('link', { name: '已收藏 (2)' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '連續行程 (3)' })).toBeInTheDocument();
  // The number drawn is bare and hidden from screen readers (they read '(2)' after the name).
  expect(screen.getByText('2')).toHaveAttribute('aria-hidden', 'true');
  // The trip forgotten (清空), its number goes with it.
  act(() => { rememberTrip({ ...chain, legs: [] }); });
  expect(screen.getByRole('link', { name: '連續行程' })).toBeInTheDocument();
});

// Task 71: the trip survives leaving its page.
it('連續行程 goes to the remembered trip, in the page\'s language; with none, to /chain', () => {
  const chain = { legs: [{ tourKey: 'egl:KIX5', departure: '2026-12-18' }], gap: { min: 2, max: 4 } };
  const { unmount } = render(<TabBar t={makeT('en')} />);
  expect(screen.getByRole('link', { name: 'Plan a trip' })).toHaveAttribute('href', '/en/chain');
  act(() => { rememberTrip(chain); });
  expect(screen.getByRole('link', { name: 'Plan a trip (1)' })).toHaveAttribute('href', '/en/chain?legs=egl%3AKIX5%402026-12-18&gap=2-4');
  unmount();
  // Read from the browser on another page (after a reload), and cleaned as an address is: the unreadable leg and
  // everything after it go, and the gap is put in order.
  resetTripCache();
  window.localStorage.setItem(TRIP_KEY, JSON.stringify({ legs: 'egl:KIX5@2026-12-18,nope,egl:B@2027-01-02', gap: '9-1' }));
  render(<TabBar t={tZh} />);
  expect(screen.getByRole('link', { name: '連續行程 (1)' })).toHaveAttribute('href', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-9');
});

it('a stored trip that cannot be read is no trip; and where storage cannot be used, the trip is remembered for this page\'s life', () => {
  for (const junk of ['{', '"x"', 'null', '{"legs":3}', '{"legs":"junk"}', '{"legs":""}']) {
    resetTripCache();
    window.localStorage.setItem(TRIP_KEY, junk);
    const { unmount } = render(<TabBar t={tZh} />);
    expect(screen.getByRole('link', { name: '連續行程' })).toHaveAttribute('href', '/chain');
    unmount();
  }
  resetTripCache();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError'); });
  render(<TabBar t={tZh} />);
  act(() => { rememberTrip({ legs: [{ tourKey: 'egl:KIX5', departure: '2026-12-18' }], gap: { min: 1, max: 3 } }); });
  expect(screen.getByRole('link', { name: '連續行程 (1)' })).toHaveAttribute('href', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3');
});

it('a change in another tab reaches the badge (the storage event)', () => {
  render(<TabBar t={tZh} />);
  window.localStorage.setItem(TRIP_KEY, JSON.stringify({ legs: 'egl:KIX5@2026-12-18,egl:B@2027-01-02', gap: '1-3' }));
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: TRIP_KEY })); });
  expect(screen.getByRole('link', { name: '連續行程 (2)' })).toBeInTheDocument();
});

it('the badges are the browser\'s: the server renders none, and they appear after hydration without a mismatch warning', async () => {
  window.localStorage.setItem(SAVED_KEY, JSON.stringify([{ key: 'egl:KIX5', savedAt: 1, label: 'x' }]));
  window.localStorage.setItem(TRIP_KEY, JSON.stringify({ legs: 'egl:KIX5@2026-12-18,egl:B@2027-01-02', gap: '1-3' }));
  const html = renderToString(<TabBar t={tZh} />);
  expect(html).not.toMatch(/\([12]\)/);
  expect(html).not.toContain('legs=');
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => { root = hydrateRoot(container, <TabBar t={tZh} />); });
    expect(errors).not.toHaveBeenCalled();
    expect(container.textContent).toContain('(1)');
    expect(container.textContent).toContain('(2)');
    expect(container.querySelector('a[href^="/chain?legs="]')).not.toBeNull();
  } finally {
    if (root) act(() => root!.unmount());
    container.remove();
  }
});

it('a badge never moves anything: it is drawn out of the layout, over the icon\'s corner', () => {
  expect(css()).toMatch(/\.badge \{ position: absolute;/);
  expect(css()).toMatch(/\.tab \{ position: relative;/);
});

it('slides away while the page scrolls down, comes back on scrolling up, at the top, and when focus moves into it', () => {
  vi.useFakeTimers();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => setTimeout(() => cb(0), 0) as unknown as number);
  try {
    render(<TabBar t={tZh} />);
    expect(bar()).not.toHaveAttribute('data-hidden');
    scrollTo(400);
    expect(bar()).toHaveAttribute('data-hidden');
    scrollTo(404); // a jitter: nothing changes
    expect(bar()).toHaveAttribute('data-hidden');
    scrollTo(300);
    expect(bar()).not.toHaveAttribute('data-hidden');
    scrollTo(800);
    expect(bar()).toHaveAttribute('data-hidden');
    act(() => { screen.getAllByRole('link')[1].focus(); });
    expect(bar()).not.toHaveAttribute('data-hidden');
    scrollTo(1200);
    expect(bar()).not.toHaveAttribute('data-hidden'); // focus is still in it
    act(() => { (document.activeElement as HTMLElement).blur(); });
    scrollTo(1600);
    expect(bar()).toHaveAttribute('data-hidden');
    scrollTo(0);
    expect(bar()).not.toHaveAttribute('data-hidden');
  } finally {
    vi.useRealTimers();
  }
});

it('listens to scrolling passively and slides with a transform only (no layout), instantly with reduced motion; without JavaScript it stays', () => {
  const add = vi.spyOn(window, 'addEventListener');
  render(<TabBar t={tZh} />);
  expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
  expect(css()).toMatch(/\.bar\[data-hidden\] \{ transform: translateY\(100%\); \}/);
  expect(css()).toMatch(/@media \(max-width: 1023px\) and \(prefers-reduced-motion: reduce\) \{ \.bar \{ transition: none; \} \}/);
  // Hidden only by the attribute the script sets: the server's HTML has none.
  expect(renderToString(<TabBar t={tZh} />)).not.toContain('data-hidden');
});

it('phones only: fixed to the window\'s foot, 56px plus the bottom safe area, with a spacer as tall ending the page; not from 1024px, nor on a short landscape screen', () => {
  expect(css()).toMatch(/^.*?\.bar, \.spacer \{ display: none; \}/);
  expect(css()).toMatch(/@media \(max-width: 1023px\) \{ \.spacer \{ display: block; height: calc\(56px \+ env\(safe-area-inset-bottom, 0px\)\); \}/);
  expect(css()).toMatch(/\.bar \{ display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: 900; padding-bottom: env\(safe-area-inset-bottom, 0px\);/);
  expect(css()).toMatch(/\.tab \{[^}]*height: 56px;/);
  expect(css()).toMatch(/@media \(max-width: 1023px\) and \(orientation: landscape\) and \(max-height: 500px\) \{ \.bar, \.spacer \{ display: none; \} \}/);
  render(<TabBar t={tZh} />);
  expect(bar().previousElementSibling).toHaveAttribute('aria-hidden', 'true');
});

it('the current tab: a gold top edge, the header\'s text colour and bold; the others muted', () => {
  expect(css()).toMatch(/\.tab\[aria-current='page'\] \{ border-top-color: var\(--header-accent\); color: var\(--header-text\); font-weight: 700; \}/);
  expect(css()).toMatch(/background: var\(--header-bg\); color: var\(--header-muted\);/);
});

it('a page that belongs to no tab though its address looks like one (a not-found page under /tours/…) marks none while it is shown', () => {
  address.pathname = '/tours/atlantis';
  const { rerender } = render(<><TabBar t={tZh} /><NoCurrentTab /></>);
  expect(screen.getAllByRole('link').map(a => a.getAttribute('aria-current'))).toEqual([null, null, null]);
  rerender(<TabBar t={tZh} />);
  expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('搜尋');
});

it('slides away while a card\'s list of dates is open, so it never covers the list', () => {
  expect(css()).toMatch(/@media \(max-width: 1023px\) \{[^@]*:global\(body:has\(\[data-departure-picker\]\)\) \.bar \{ transform: translateY\(100%\); \}/);
});
