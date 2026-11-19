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
/** The two page links (the language switch's links are in their own group). */
const pageLinks = () => screen.getAllByRole('link').filter(link => !link.closest('[role="group"]'));
const css = () => readFileSync(join(__dirname, 'NavBar.module.css'), 'utf8').replace(/\s+/g, ' ');

it('shows the site name and both links', () => {
  render(<NavBar current="search" t={tZh} />);
  expect(screen.getByText('跟邊團')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '搜尋旅行團' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: '連續行程' })).toHaveAttribute('href', '/chain');
});

it.each([
  ['zh-Hans', '/zh-hans', '/zh-hans/chain'],
  ['en', '/en', '/en/chain'],
] as const)('in %s, both links stay in the language: %s and %s', (locale, search, chain) => {
  render(<NavBar current="search" t={makeT(locale)} />);
  expect(pageLinks().map(l => l.getAttribute('href'))).toEqual([search, chain]);
});

it('marks the current page', () => {
  render(<NavBar current="chain" t={tZh} />);
  expect(screen.getByRole('link', { name: '連續行程' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: '搜尋旅行團' })).not.toHaveAttribute('aria-current');
});

it('shows the mark immediately before the site name, hidden from assistive technology', () => {
  const { container } = render(<NavBar current="search" t={tZh} />);
  const name = screen.getByText('跟邊團');
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
  // The links' accessible names are unchanged.
  expect(pageLinks().map(l => l.textContent)).toEqual(['搜尋旅行團', '連續行程']);
});

it('draws the mark in the nav bar\'s fixed colouring from the theme (dark bar in both themes), sized to the name\'s line', () => {
  expect(css()).toMatch(/\.mark \{[^}]*--mark-primary: var\(--bar-text\)/);
  expect(css()).toMatch(/\.mark \{[^}]*--mark-accent: var\(--bar-accent\)/);
  expect(css()).toMatch(/\.mark \{[^}]*height: 1\.3em/);
  expect(css()).toMatch(/\.mark \{[^}]*flex: none/); // never squeezed at narrow widths
  expect(css()).not.toMatch(/#[0-9a-f]{3,8}\b/i);
});

it('ends with the language switch, labelled in the current language', () => {
  render(<NavBar current="search" t={makeT('en')} />);
  const nav = screen.getByRole('navigation');
  const group = screen.getByRole('group', { name: 'Language' });
  expect(nav).toContainElement(group);
  const links = pageLinks();
  expect(links.map(l => l.textContent)).toEqual(['Find tours', 'Plan a trip']);
  expect(links[1].compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

it('wraps rather than scrolling sideways if a very narrow screen cannot fit the switch on the line', () => {
  expect(css()).toMatch(/\.inner \{[^}]*flex-wrap: wrap/);
});
