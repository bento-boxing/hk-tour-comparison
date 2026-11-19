import { it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { renderToReadableStream } from 'react-dom/server';
import { makeT } from '../lib/i18n';
import { LanguageSwitch } from './LanguageSwitch';

// The address the switch is on: usePathname and useSearchParams read it.
const address = vi.hoisted(() => ({ pathname: '/', search: '', suspendFirst: false, ready: false }));
vi.mock('next/navigation', () => ({
  usePathname: () => address.pathname,
  useSearchParams: () => {
    // As on the built site: on the server's first pass the boundary is still pending (the stand-in suspends once,
    // then answers), so the start of the served HTML has the fallback and the resolved links come later.
    if (address.suspendFirst && !address.ready) {
      throw new Promise<void>(resolve => setTimeout(() => { address.ready = true; resolve(); }, 20));
    }
    return new URLSearchParams(address.search);
  },
}));

beforeEach(() => { address.pathname = '/'; address.search = ''; address.suspendFirst = false; address.ready = false; });

/** The whole streamed server response for the switch, as text. */
async function serve(element: React.ReactElement): Promise<string> {
  // Read as it streams: the start of the page is sent before the pending boundary resolves.
  return new Response(await renderToReadableStream(element)).text();
}
const hrefsIn = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map(m => m[1].replaceAll('&amp;', '&'));

const css = () => readFileSync(join(__dirname, 'LanguageSwitch.module.css'), 'utf8').replace(/\s+/g, ' ');

it.each([
  ['zh-Hant', '/', '語言', '繁體中文'],
  ['zh-Hans', '/zh-hans', '语言', '简体中文'],
  ['en', '/en', 'Language', 'English'],
] as const)('in %s (%s): a group labelled %s with three links, each language named in itself, the current one marked', (locale, pathname, label, current) => {
  address.pathname = pathname;
  render(<LanguageSwitch t={makeT(locale)} />);
  const group = screen.getByRole('group', { name: label });
  const links = within(group).getAllByRole('link');
  expect(links.map(a => a.getAttribute('aria-label'))).toEqual(['繁體中文', '简体中文', 'English']);
  // Ordinary links: they work without JavaScript, and are not buttons or a form.
  for (const a of links) expect(a.tagName).toBe('A');
  expect(group.closest('form')).toBeNull();
  expect(links.map(a => a.getAttribute('lang'))).toEqual(['zh-Hant-HK', 'zh-Hans', 'en']);
  expect(links.map(a => a.getAttribute('hreflang'))).toEqual(['zh-Hant', 'zh-Hans', 'en']);
  for (const a of links) {
    if (a.getAttribute('aria-label') === current) expect(a).toHaveAttribute('aria-current', 'true');
    else expect(a).not.toHaveAttribute('aria-current');
  }
  // Full names always; the short forms are for narrow screens and hidden from assistive technology.
  expect(links.map(a => a.textContent)).toEqual(['繁體中文繁', '简体中文简', 'EnglishEN']);
  for (const short of ['繁', '简', 'EN']) expect(within(group).getByText(short)).toHaveAttribute('aria-hidden', 'true');
});

const LEGS = 'legs=egl%3AKIX5%402026-12-18&gap=1-3&ex=japan&page=2';

it.each([
  ['zh-Hant', '/', '', ['/', '/zh-hans', '/en']],
  ['zh-Hant', '/', 'dest=japan&dmin=5&page=3', ['/?dest=japan&dmin=5&page=3', '/zh-hans?dest=japan&dmin=5&page=3', '/en?dest=japan&dmin=5&page=3']],
  ['en', '/en', 'dest=japan&dmin=5', ['/?dest=japan&dmin=5', '/zh-hans?dest=japan&dmin=5', '/en?dest=japan&dmin=5']],
  ['zh-Hans', '/zh-hans/chain', '', ['/chain', '/zh-hans/chain', '/en/chain']],
  ['en', '/en/chain', LEGS, [`/chain?${LEGS}`, `/zh-hans/chain?${LEGS}`, `/en/chain?${LEGS}`]],
  ['zh-Hant', '/chain', LEGS, [`/chain?${LEGS}`, `/zh-hans/chain?${LEGS}`, `/en/chain?${LEGS}`]],
] as const)('in %s at %s?%s: each link is the same page with the same query string (filters, page, chain plan) in its language', (locale, pathname, search, hrefs) => {
  address.pathname = pathname;
  address.search = search;
  render(<LanguageSwitch t={makeT(locale)} />);
  expect(screen.getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(hrefs);
});

it('before the page\'s scripts run, the visible links are the same page in each language WITHOUT the query string; the links with it come later in the response, hidden, for a script to swap in', async () => {
  address.pathname = '/en/chain';
  address.search = 'legs=egl%3AKIX5%402026-12-18&gap=1-3&dmin=4';
  address.suspendFirst = true;
  const html = await serve(<LanguageSwitch t={makeT('en')} />);
  const hidden = html.indexOf('<div hidden id="S:');
  expect(hidden).toBeGreaterThan(0);
  // What a visitor without JavaScript sees and follows: the fallback, inside the pending boundary.
  expect(html.slice(0, hidden)).toContain('<!--$?-->');
  expect(hrefsIn(html.slice(0, hidden))).toEqual(['/chain', '/zh-hans/chain', '/en/chain']);
  // What the inline script swaps in: the same links with the whole query string.
  const query = 'legs=egl%3AKIX5%402026-12-18&gap=1-3&dmin=4';
  expect(hrefsIn(html.slice(hidden))).toEqual([`/chain?${query}`, `/zh-hans/chain?${query}`, `/en/chain?${query}`]);
});

it('is reachable by keyboard, in the order 繁 简 EN', async () => {
  const { default: userEvent } = await import('@testing-library/user-event');
  render(<LanguageSwitch t={makeT('zh-Hant')} />);
  await userEvent.tab();
  expect(screen.getByRole('link', { name: '繁體中文' })).toHaveFocus();
  await userEvent.tab();
  expect(screen.getByRole('link', { name: '简体中文' })).toHaveFocus();
  await userEvent.tab();
  expect(screen.getByRole('link', { name: 'English' })).toHaveFocus();
});

it('is 44px tall for touch, sits at the right, looks as the buttons did, and drops to 繁 / 简 / EN on phones', () => {
  expect(css()).toMatch(/\.option \{[^}]*display: inline-flex; align-items: center;/);
  expect(css()).toMatch(/\.option \{[^}]*min-height: 44px/);
  expect(css()).toMatch(/\.option \{[^}]*text-decoration: none/); // a link, but no underline except the current one's
  expect(css()).toMatch(/\.option\[aria-current='true'\] \{[^}]*text-decoration: underline; text-decoration-color: var\(--bar-accent\)/);
  expect(css()).toMatch(/\.switch \{ margin: 0 0 0 auto; \}/);
  expect(css()).toMatch(/\.short \{ display: none; \}/);
  expect(css()).toMatch(/@media \(max-width: 639px\) \{[^@]*\.long \{ display: none; \}[^@]*\.short \{ display: inline; \}/);
  // Phones: 26px wide (above the 24px minimum touch target), so the bar keeps one row at 375px in every language.
  expect(css()).toMatch(/@media \(max-width: 639px\) \{ \.option \{ min-width: 26px; padding: 0 3px; \}/);
  expect(css()).not.toMatch(/#[0-9a-f]{3,8}\b/i);
});
