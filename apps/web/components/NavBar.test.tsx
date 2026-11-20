import { it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { NavBar } from './NavBar';
import { makeT } from '../lib/i18n';

// The language switch inside reads the address.
const address = vi.hoisted(() => ({ pathname: '/', search: '' }));
vi.mock('next/navigation', () => ({ usePathname: () => address.pathname, useSearchParams: () => new URLSearchParams(address.search) }));
vi.mock('../lib/theme-action', () => ({ setTheme: vi.fn() }));

const tZh = makeT('zh-Hant');
/** The page links (the brand's link home and the language switch's links are not among them). */
const pageLinks = () => screen.getAllByRole('link').filter(link => !link.closest('[role="group"]') && link.textContent !== '跟邊團');
const css = () => readFileSync(join(__dirname, 'NavBar.module.css'), 'utf8').replace(/\s+/g, ' ');

it('shows the site name, linking to the search page, and the three page links', () => {
  render(<NavBar current="search" t={tZh} />);
  expect(screen.getByRole('link', { name: '跟邊團' })).toHaveAttribute('href', '/');
  expect(pageLinks().map(l => [l.textContent, l.getAttribute('href')])).toEqual([
    ['搜尋旅行團', '/'], ['連續行程', '/chain'], ['所有目的地', '/tours'],
  ]);
});

it.each([
  ['zh-Hans', ['/zh-hans', '/zh-hans/chain', '/zh-hans/tours'], '/zh-hans'],
  ['en', ['/en', '/en/chain', '/en/tours'], '/en'],
] as const)('in %s, every link stays in the language', (locale, hrefs, home) => {
  render(<NavBar current="search" t={makeT(locale)} />);
  expect(pageLinks().map(l => l.getAttribute('href'))).toEqual(hrefs);
  expect(screen.getByRole('link', { name: '跟邊團' })).toHaveAttribute('href', home);
});

it.each(['search', 'chain', 'destinations'] as const)('marks the current page (%s) and only it', current => {
  render(<NavBar current={current} t={tZh} />);
  const index = ['search', 'chain', 'destinations'].indexOf(current);
  expect(pageLinks().map(l => l.getAttribute('aria-current'))).toEqual([0, 1, 2].map(i => (i === index ? 'page' : null)));
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
  expect(links.map(l => l.textContent)).toEqual(['Find tours', 'Plan a trip', 'Destinations']);
  expect(links[2].compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(group).getByRole('link', { name: 'English' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByText('跟邊團')).toBeInTheDocument(); // the brand stays 跟邊團 in English
});

it('ends with the theme switch, after the language switch, named in the current language', () => {
  render(<NavBar current="search" t={makeT('en')} />);
  const nav = screen.getByRole('navigation');
  const group = screen.getByRole('group', { name: 'Language' });
  const toDark = screen.getByRole('button', { name: 'Switch to dark theme' });
  expect(nav).toContainElement(toDark);
  expect(group.compareDocumentPosition(toDark) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
});

it('on a phone it is two rows (the name and the switches, then the three links) and wraps rather than scroll sideways', () => {
  expect(css()).toMatch(/\.inner \{[^}]*flex-wrap: wrap/);
  expect(css()).toMatch(/@media \(max-width: 639px\) \{.*\.tools \{ order: 2;[^}]*\}.*\.links \{ order: 3; flex-basis: 100%;/);
});
