import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { NavBar } from './NavBar';
import { makeT } from '../lib/i18n';
import { resetSavedCache, saveTour, SAVED_KEY } from '../lib/saved-tours';

// The language switch inside reads the address.
const address = vi.hoisted(() => ({ pathname: '/', search: '' }));
vi.mock('next/navigation', () => ({ usePathname: () => address.pathname, useSearchParams: () => new URLSearchParams(address.search) }));
// next/link as a plain <a> that shows the prefetch setting it was given (data-prefetch), so the tests can check it.
vi.mock('next/link', () => ({
  default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean | null; children: React.ReactNode }) =>
    <a href={href} data-prefetch={prefetch === undefined ? 'default' : String(prefetch)} {...rest}>{children}</a>,
}));

const tZh = makeT('zh-Hant');
/** The page links (the brand's link home and the language switch's links are not among them). */
const pageLinks = () => screen.getAllByRole('link').filter(link => !link.closest('[role="group"]') && link.textContent !== '跟邊團');
beforeEach(() => { window.localStorage.clear(); resetSavedCache(); });
afterEach(() => { vi.restoreAllMocks(); });
const savedLink = () => screen.getByRole('link', { name: /^已收藏|^Saved/ });
/** What a link shows: its text without the hidden copy that keeps the saved link's room. */
const shown = (link: Element) => {
  const copy = link.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach(hidden => hidden.remove());
  return copy.textContent;
};
const css = () => readFileSync(join(__dirname, 'NavBar.module.css'), 'utf8').replace(/\s+/g, ' ');

it('shows the site name, linking to the search page, the three page links and 已收藏 with its number', () => {
  render(<NavBar current="search" t={tZh} />);
  expect(screen.getByRole('link', { name: '跟邊團' })).toHaveAttribute('href', '/');
  expect(pageLinks().map(l => [shown(l), l.getAttribute('href')])).toEqual([
    ['搜尋旅行團', '/'], ['連續行程', '/chain'], ['所有目的地', '/tours'], ['已收藏 (0)', '/saved'],
  ]);
  expect(savedLink()).toHaveAccessibleName('已收藏 (0)');
});

it.each([
  ['zh-Hans', ['/zh-hans', '/zh-hans/chain', '/zh-hans/tours', '/zh-hans/saved'], '/zh-hans'],
  ['en', ['/en', '/en/chain', '/en/tours', '/en/saved'], '/en'],
] as const)('in %s, every link stays in the language', (locale, hrefs, home) => {
  render(<NavBar current="search" t={makeT(locale)} />);
  expect(pageLinks().map(l => l.getAttribute('href'))).toEqual(hrefs);
  expect(screen.getByRole('link', { name: '跟邊團' })).toHaveAttribute('href', home);
});

it.each(['search', 'chain', 'destinations', 'saved'] as const)('marks the current page (%s) and only it', current => {
  render(<NavBar current={current} t={tZh} />);
  const index = ['search', 'chain', 'destinations', 'saved'].indexOf(current);
  expect(pageLinks().map(l => l.getAttribute('aria-current'))).toEqual([0, 1, 2, 3].map(i => (i === index ? 'page' : null)));
});

it('marks no page on the pages that have no link (the about page, a 404)', () => {
  render(<NavBar t={tZh} />);
  expect(pageLinks().filter(l => l.hasAttribute('aria-current'))).toEqual([]);
});

it('shows the mark immediately before the site name, hidden from assistive technology', () => {
  const { container } = render(<NavBar current="search" t={tZh} />);
  const name = screen.getByRole('link', { name: '跟邊團' });
  // The only drawing outside a button (the theme switch's icons are inside its buttons).
  const svgs = [...container.querySelectorAll('nav svg')].filter(svg => !svg.closest('button'));
  expect(svgs).toHaveLength(1);
  const mark = svgs[0];
  expect(mark).toHaveAttribute('aria-hidden', 'true');
  expect(mark).toHaveAttribute('focusable', 'false');
  // The mark sits inside the brand, as its first child, so it is directly before the name.
  expect(name.firstElementChild).toBe(mark);
  // The brand reads as the site name alone: the mark adds no text and no image to the accessibility tree.
  expect(name.textContent).toBe('跟邊團');
  expect(screen.queryByRole('img')).toBeNull();
});

it('draws the header in ink (near-black in dark), the mark\'s route in the header\'s text colour and its next leg in gold', () => {
  expect(css()).toMatch(/\.bar \{ background: var\(--header-bg\); color: var\(--header-text\); \}/);
  expect(css()).toMatch(/\.mark \{ --mark-primary: var\(--header-text\); --mark-accent: var\(--header-accent\);[^}]*flex: none/);
  // The current page: bold with the gold underline (the weight is a cue that is not colour).
  expect(css()).toMatch(/\.current, \.current:hover \{ font-weight: 700; border-bottom-color: var\(--header-accent\); \}/);
  expect(css()).toMatch(/\.link \{[^}]*min-height: 44px/);
});

it('ends with the language switch, labelled in the current language', () => {
  render(<NavBar current="search" t={makeT('en')} />);
  const nav = screen.getByRole('navigation');
  const group = screen.getByRole('group', { name: 'Language' });
  expect(nav).toContainElement(group);
  const links = pageLinks();
  expect(links.map(shown)).toEqual(['Find tours', 'Plan a trip', 'Destinations', 'Saved (0)']);
  expect(links[3].compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(group).getByRole('link', { name: 'English' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByText('跟邊團')).toBeInTheDocument(); // the brand stays 跟邊團 in English
});

it('ends with the theme switch, after the language switch, named in the current language', () => {
  render(<NavBar current="search" t={makeT('en')} />);
  const nav = screen.getByRole('navigation');
  const group = screen.getByRole('group', { name: 'Language' });
  // One button with a face per theme; CSS shows one (no CSS here, so both faces' names count: ThemeSwitch.test.tsx).
  const toggle = screen.getByRole('button', { name: /^Switch to dark theme\s*Switch to light theme$/ });
  expect(nav).toContainElement(toggle);
  expect(group.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('on a phone: the name and the switches, then the four links on a line of their own; two by two only where one line cannot hold them', () => {
  expect(css()).toMatch(/\.inner \{[^}]*flex-wrap: wrap/);
  expect(css()).toMatch(/@media \(max-width: 639px\) \{.*\.tools \{ order: 2;[^}]*\}.*\.links \{ order: 3; flex-basis: 100%;/);
  // Chinese: one line down to 360px; English (longer) from 430px.
  expect(css()).toMatch(/@media \(max-width: 359px\) \{ \.links:lang\(zh\) \{ display: grid; grid-template-columns: repeat\(2, max-content\);/);
  expect(css()).toMatch(/@media \(max-width: 429px\) \{ \.links:lang\(en\) \{ display: grid; grid-template-columns: repeat\(2, max-content\);/);
  expect(css()).not.toMatch(/@media \(max-width: 479px\)/);
});

it('the saved link is always plain /saved in the page\'s language and never prefetched: the list never leaves the browser from here', () => {
  saveTour('egl:KIX5');
  saveTour('jetour:THB');
  for (const [locale, href] of [['zh-Hant', '/saved'], ['zh-Hans', '/zh-hans/saved'], ['en', '/en/saved']] as const) {
    const { unmount } = render(<NavBar current="search" t={makeT(locale)} />);
    expect(savedLink()).toHaveAttribute('href', href);
    expect(savedLink().getAttribute('href')).not.toMatch(/\?|KIX5|THB/);
    expect(savedLink()).toHaveAttribute('data-prefetch', 'false');
    unmount();
  }
});

it('no header link pre-loads its page (each is made per request): the name, the three page links and the saved link', () => {
  render(<NavBar current="search" t={tZh} />);
  const links = [screen.getByRole('link', { name: '跟邊團' }), ...pageLinks()];
  expect(links).toHaveLength(5);
  for (const link of links) expect(link, link.getAttribute('href') ?? '').toHaveAttribute('data-prefetch', 'false');
});

it('the number is this browser\'s saved tours; it follows a save at once, and the link stays plain', () => {
  saveTour('egl:KIX5');
  saveTour('jetour:THB');
  render(<NavBar current="search" t={tZh} />);
  expect(savedLink()).toHaveAccessibleName('已收藏 (2)');
  act(() => { saveTour('bigline:X1'); });
  expect(savedLink()).toHaveAccessibleName('已收藏 (3)');
  expect(savedLink()).toHaveAttribute('href', '/saved');
});

it('follows another tab: a save there changes the number here', () => {
  render(<NavBar current="search" t={makeT('en')} />);
  expect(savedLink()).toHaveAccessibleName('Saved (0)');
  act(() => {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify([{ key: 'egl:KIX5', savedAt: 1 }]));
    window.dispatchEvent(new StorageEvent('storage', { key: SAVED_KEY }));
  });
  expect(savedLink()).toHaveAccessibleName('Saved (1)');
  expect(savedLink()).toHaveAttribute('href', '/en/saved');
});

it('where the browser keeps nothing: the link without a number', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
  render(<NavBar current="search" t={tZh} />);
  expect(savedLink()).toHaveAccessibleName('已收藏');
  expect(savedLink()).toHaveAttribute('href', '/saved');
});

it('room for "(100)" is kept by a hidden copy stacked with the text, so nothing moves when the number appears; the underline is the text\'s own', () => {
  render(<NavBar current="saved" t={tZh} />);
  const link = savedLink();
  const room = link.querySelector('[aria-hidden="true"]')!;
  expect(room).toHaveTextContent('已收藏 (100)');
  expect(room.className).toMatch(/savedRoom/);
  expect(css()).toMatch(/\.savedText, \.savedRoom \{ grid-area: 1 \/ 1;/);
  expect(css()).toMatch(/\.savedRoom \{ visibility: hidden; \}/);
  // The link draws no underline of its own; the visible text does, so it is as long as what it underlines.
  expect(css()).toMatch(/\.savedLink, \.savedLink:hover, \.savedLink\.current, \.savedLink\.current:hover \{ border-bottom-color: transparent; \}/);
  expect(css()).toMatch(/\.savedLink\.current \.savedText \{ border-bottom-color: var\(--header-accent\); \}/);
  expect(css()).toMatch(/\.savedText \{ justify-self: start;/);
});

it('the server renders the link without a number; the number appears after hydration with no mismatch warning', async () => {
  saveTour('egl:KIX5');
  const html = renderToString(<NavBar current="search" t={tZh} />);
  expect(html).toContain('href="/saved"');
  expect(html).not.toMatch(/\(1\)/);
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  let root: ReturnType<typeof hydrateRoot> | undefined;
  await act(async () => { root = hydrateRoot(container, <NavBar current="search" t={tZh} />); });
  expect(errors).not.toHaveBeenCalled();
  const link = container.querySelector('a[href="/saved"]')!;
  expect(shown(link)).toBe('已收藏 (1)');
  act(() => root!.unmount());
  container.remove();
});
