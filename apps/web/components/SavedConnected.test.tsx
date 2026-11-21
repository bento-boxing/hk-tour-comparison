import { it, expect, vi, beforeAll, afterAll, beforeEach, afterEach, describe } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { OperatorInfo } from '@hktours/db/read';
import type { TourRow } from '../lib/tour-row';
import { I18nProvider } from '../lib/i18n-client';
import type { Locale } from '../lib/i18n';
import { resetSavedCache, SAVED_KEY } from '../lib/saved-tours';
import { parseSavedKeys, savedHref } from '../lib/saved-list';
import { SavedConnected } from './SavedConnected';
import styles from './SavedConnected.module.css';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const router = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>(), replace: vi.fn<(href: string, opts?: unknown) => void>() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
// next/link as a plain <a> that shows the prefetch setting it was given.
vi.mock('next/link', () => ({
  default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean | null; children: React.ReactNode }) =>
    <a href={href} data-prefetch={prefetch === undefined ? 'default' : String(prefetch)} {...rest}>{children}</a>,
}));

beforeAll(() => { vi.setSystemTime(new Date('2026-11-12T04:00:00Z')); });
afterAll(() => { vi.useRealTimers(); });
beforeEach(() => { router.push.mockReset(); router.replace.mockReset(); window.localStorage.clear(); resetSavedCache(); });
afterEach(() => { vi.restoreAllMocks(); });

const operators: OperatorInfo[] = [
  { id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: '2026-11-11T19:10:00Z' },
  { id: 'jetour', nameZh: '捷旅', nameEn: 'Jetour', color: '#ee7b06', lastGoodRunAt: '2026-11-11T19:10:00Z' },
];
const row = (key: string, operatorId: 'egl' | 'jetour'): TourRow => ({
  key, operatorId, url: `https://example.test/${key.replace(':', '/')}`, days: 5, nights: 4,
  stops: [{ countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' }],
  start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
  fromPriceHkd: 7999, windowPriceHkd: 7999, fallbackPriceHkd: 7999,
  departures: [{ date: '2026-12-18', priceHkd: 7999 }], priceChange: null, lastUpdated: '2026-11-11T19:10:00Z',
});
const A = row('egl:KIX5', 'egl');
const B = row('jetour:THB', 'jetour');
/** The tours the stand-in server lists now; anything else asked for is no longer listed. */
const LISTED = new Map([A, B].map(tour => [tour.key, tour]));

/** Stores this browser's list, oldest first (so the page shows the last first), each with a label. */
const store = (keys: string[], labels: Record<string, string> = {}) => window.localStorage.setItem(SAVED_KEY,
  JSON.stringify(keys.map((key, i) => ({ key, savedAt: i + 1, ...(labels[key] ? { label: labels[key] } : {}) }))));
const storedKeys = () => JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '[]').map((s: { key: string }) => s.key);
/** The tour rows (the ARIA table's rows with cells), by their operator. */
const rowNames = () => screen.queryAllByRole('row').filter(r => within(r).queryAllByRole('cell').length > 0)
  .map(r => within(r).getAllByRole('cell')[0].textContent);

/**
 * The page as the app runs it: a router whose replace really changes the address, and a stand-in server that renders
 * the address's tours (the listed ones), so the props change as they do in the browser.
 */
function Page({ initial, locale = 'zh-Hant' }: { initial: string; locale?: Locale }) {
  const [address, setAddress] = useState(initial);
  router.replace.mockImplementation(href => { setAddress(href.replace(/^\/(en|zh-hans)/, '')); });
  const { keys, dropped } = parseSavedKeys(Object.fromEntries(new URLSearchParams(address.split('?')[1] ?? '')));
  return (
    <I18nProvider locale={locale}>
      <p data-testid="address">{address}</p>
      <SavedConnected
        asked={keys} dropped={dropped} tours={keys.flatMap(k => LISTED.get(k) ?? [])} operators={operators}
        today="2026-11-12" now="2026-11-12T04:00:00Z"
      />
    </I18nProvider>
  );
}
const address = () => screen.getByTestId('address').textContent;

describe('the visitor\'s own list', () => {
  it('the saved tours as the search page\'s rows, newest saved first, each with 已收藏 pressed, 加入行程 and its link', () => {
    store(['egl:KIX5', 'jetour:THB']);
    render(<Page initial={savedHref(['jetour:THB', 'egl:KIX5'])} />);
    expect(screen.getByRole('table', { name: '旅行團' })).toBeInTheDocument();
    expect(rowNames()).toEqual(['捷旅', '東瀛遊']);
    for (const button of screen.getAllByRole('button', { name: /^收藏「/ })) expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: '加入行程 +' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: /^東瀛遊：/ })).toHaveAttribute('href', 'https://example.test/egl/KIX5');
    expect(screen.queryByRole('status')).toBeNull(); // no note: it is the visitor's own list
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('removing one (its 已收藏) takes its row away at once, keeps the address in step, and moves focus to the next row', async () => {
    const user = userEvent.setup();
    store(['egl:KIX5', 'jetour:THB']);
    render(<Page initial={savedHref(['jetour:THB', 'egl:KIX5'])} />);
    await user.click(screen.getByRole('button', { name: /^收藏「捷旅/ }));
    expect(rowNames()).toEqual(['東瀛遊']);
    expect(storedKeys()).toEqual(['egl:KIX5']);
    expect(address()).toBe(savedHref(['egl:KIX5']));
    expect(screen.getByRole('button', { name: /^收藏「東瀛遊/ })).toHaveFocus();
  });

  it('removing the last: the empty state at once and never taken down while the address follows; focus on its heading', async () => {
    const user = userEvent.setup();
    store(['egl:KIX5']);
    render(<Page initial={savedHref(['egl:KIX5'])} />);
    const mounts: number[] = [];
    const observer = new MutationObserver(records => {
      for (const r of records) for (const n of [...r.addedNodes, ...r.removedNodes]) {
        if (n instanceof Element && n.textContent?.includes('未有收藏的旅行團。')) mounts.push(r.addedNodes.length ? 1 : -1);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    await user.click(screen.getByRole('button', { name: /^收藏「/ }));
    observer.disconnect();
    expect(rowNames()).toEqual([]);
    expect(address()).toBe('/saved');
    // Added once, never removed (no flicker between the removal and the new address).
    expect(mounts).toEqual([1]);
    expect(screen.getByRole('heading', { name: '未有收藏的旅行團。' })).toHaveFocus();
  });

  it('opened without a list in the address (typed, or from the header): it reads the browser\'s list into its own address', () => {
    store(['egl:KIX5', 'jetour:THB']);
    render(<Page initial="/saved" locale="en" />);
    expect(router.replace).toHaveBeenCalledWith(`/en${savedHref(['jetour:THB', 'egl:KIX5'])}`, { scroll: false });
    expect(rowNames()).toEqual(['Jetour', 'EGL Tours']);
  });

  it('the same tours in another order (an older address): the browser\'s order, newest first', () => {
    store(['egl:KIX5', 'jetour:THB']);
    render(<Page initial={savedHref(['egl:KIX5', 'jetour:THB'])} />);
    expect(rowNames()).toEqual(['捷旅', '東瀛遊']);
    expect(address()).toBe(savedHref(['jetour:THB', 'egl:KIX5']));
  });

  it('a tour saved in another tab joins the list: the address follows and the page stays the visitor\'s own', () => {
    store(['egl:KIX5']);
    render(<Page initial={savedHref(['egl:KIX5'])} />);
    act(() => {
      store(['egl:KIX5', 'jetour:THB']);
      window.dispatchEvent(new StorageEvent('storage', { key: SAVED_KEY }));
    });
    expect(address()).toBe(savedHref(['jetour:THB', 'egl:KIX5']));
    expect(rowNames()).toEqual(['捷旅', '東瀛遊']);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('a saved tour that is no longer listed is shown by the label kept when it was saved (never a code), with 移除', async () => {
    const user = userEvent.setup();
    store(['egl:GONE1', 'egl:KIX5'], { 'egl:GONE1': '東瀛遊：大阪、京都，5日4夜' });
    render(<Page initial={savedHref(['egl:KIX5', 'egl:GONE1'])} />);
    expect(rowNames()).toEqual(['東瀛遊']);
    const gone = screen.getByRole('region', { name: '已不再列出' });
    expect(gone).toHaveTextContent('東瀛遊：大阪、京都，5日4夜');
    expect(gone).not.toHaveTextContent('GONE1');
    await user.click(within(gone).getByRole('button', { name: '移除 東瀛遊：大阪、京都，5日4夜' }));
    expect(storedKeys()).toEqual(['egl:KIX5']);
    expect(screen.queryByRole('region', { name: '已不再列出' })).toBeNull();
    expect(address()).toBe(savedHref(['egl:KIX5']));
  });

  it('a label with a run too wide for a phone\'s line (22 of the widest letter are kept) scrolls inside its own line, never the page', () => {
    const run = `EGL Tours: ${'W'.repeat(21)}, 5 days`;
    store(['egl:GONE1', 'egl:KIX5'], { 'egl:GONE1': run });
    render(<Page initial={savedHref(['egl:KIX5', 'egl:GONE1'])} />);
    const text = within(screen.getByRole('region', { name: '已不再列出' })).getByText(run);
    // The label's text sits in a block of its own inside the line's label.
    expect(text).toHaveClass(styles.goneText);
    expect(text.parentElement).toHaveClass(styles.goneLabel);
    const css = readFileSync(join(__dirname, 'SavedConnected.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    const rule = (selector: string) => new RegExp(`(^|[ }])${selector.replace('.', '\\.')} \\{([^}]*)\\}`).exec(css)?.[2] ?? '';
    // The label is never wider than its line (so its least width, its longest word, is too), and so 移除 still moves
    // under a label whose longest word does not fit beside it; the text inside scrolls sideways when a run is wider
    // than the line, rather than breaking inside a word or scrolling the page.
    expect(rule('.goneLabel')).toMatch(/max-width: 100%/);
    expect(rule('.goneLabel')).not.toMatch(/min-width|overflow/);
    expect(rule('.goneText')).toMatch(/display: block/);
    expect(rule('.goneText')).toMatch(/overflow-x: auto/);
  });

  it('an old entry kept without a label: a plain line, still with 移除', () => {
    store(['egl:GONE1', 'egl:KIX5']);
    render(<Page initial={savedHref(['egl:KIX5', 'egl:GONE1'])} />);
    const gone = screen.getByRole('region', { name: '已不再列出' });
    expect(within(gone).getByText('一個已收藏的旅行團')).toBeInTheDocument();
    expect(within(gone).getByRole('button', { name: '移除 一個已收藏的旅行團' })).toBeInTheDocument();
  });
});

describe('the other states', () => {
  it.each([
    ['zh-Hant', '未有收藏的旅行團。', '在任何旅行團按「收藏」，它就會留在這裏，方便日後比較或再看。', '搜尋旅行團', '/'],
    ['zh-Hans', '还没有收藏的旅行团。', '在任何旅行团按“收藏”，它就会留在这里，方便以后比较或再看。', '搜索旅行团', '/zh-hans'],
    ['en', 'No saved tours yet.', 'Press “Save” on any tour and it stays here, to compare or look at later.', 'Find tours', '/en'],
  ] as const)('%s, nothing saved: two lines on what saving does, and a link to the search', (locale, first, second, link, href) => {
    render(<Page initial="/saved" locale={locale} />);
    expect(screen.getByRole('heading', { name: first })).toBeInTheDocument();
    expect(screen.getByText(second)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: link })).toHaveAttribute('href', href);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('a list from a link (not this browser\'s): shown as it is, said so, with a plain, unprefetched link to the visitor\'s own list', async () => {
    const user = userEvent.setup();
    store(['egl:KIX5']);
    render(<Page initial={savedHref(['jetour:THB'])} />);
    expect(rowNames()).toEqual(['捷旅']);
    expect(screen.getByRole('status')).toHaveTextContent('這個清單來自一個連結，未必是你自己的收藏。');
    const yours = screen.getByRole('link', { name: '查看你的收藏 (1)' });
    expect(yours).toHaveAttribute('href', '/saved');
    expect(yours).toHaveAttribute('data-prefetch', 'false');
    expect(router.replace).not.toHaveBeenCalled();
    // Its 收藏 adds the tour to the visitor's own list; the page stays the link's.
    await user.click(screen.getByRole('button', { name: /^收藏「捷旅/ }));
    expect(storedKeys()).toEqual(['egl:KIX5', 'jetour:THB']);
    expect(rowNames()).toEqual(['捷旅']);
    expect(address()).toBe(savedHref(['jetour:THB']));
  });

  it.each(['zh-Hant', 'zh-Hans', 'en'] as const)('in %s the link to the visitor\'s own list keeps its text on one line: its count never wraps away from it', locale => {
    store(['egl:KIX5']);
    render(<Page initial={savedHref(['jetour:THB'])} locale={locale} />);
    const yours = screen.getByRole('link', { name: /\(1\)$/ });
    expect(yours).toHaveClass(styles.yours);
    const css = readFileSync(join(__dirname, 'SavedConnected.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    expect(/(^|[ }])\.yours \{([^}]*)\}/.exec(css)?.[2]).toMatch(/white-space: nowrap/);
  });

  it('a visitor with nothing saved is not offered "your saved tours (0)"', () => {
    render(<Page initial={savedHref(['jetour:THB'])} />);
    expect(screen.getByRole('status')).toHaveTextContent('這個清單來自一個連結');
    expect(screen.queryByRole('link', { name: /查看你的收藏/ })).toBeNull();
  });

  it('a link\'s tours that are no longer listed: only how many, nothing taken from the address, no 移除', () => {
    render(<Page initial="/saved?t=jetour%3ATHB%2Cegl%3ACall-98765432%2Cegl%3AGONE1" />);
    expect(screen.queryByRole('region', { name: '已不再列出' })).toBeNull();
    expect(screen.getByText('連結內有 2 個旅行團已不再列出。')).toBeInTheDocument();
    // (the address itself is shown by this test's stand-in only)
    expect(document.body.textContent!.replace(address()!, '')).not.toMatch(/Call-98765432|GONE1/);
    expect(screen.queryByRole('button', { name: /移除/ })).toBeNull();
  });

  it('in English the count says how many', () => {
    render(<Page initial="/saved?t=jetour%3ATHB%2Cegl%3AGONE1" locale="en" />);
    expect(screen.getByText('1 tour in this link is no longer listed.')).toBeInTheDocument();
  });

  it('an address with unreadable parts says so', () => {
    store(['egl:KIX5']);
    render(<Page initial="/saved?t=garbage%2Cegl%3AKIX5" locale="en" />);
    expect(screen.getByRole('status')).toHaveTextContent('Some entries in this link could not be read and were left out.');
  });

  it('a link holding nothing readable: the visitor\'s own list, with one line saying so (kept after the address follows)', () => {
    store(['egl:KIX5']);
    render(<Page initial="/saved?t=garbage%2Cnobody%3AX" />);
    expect(address()).toBe(savedHref(['egl:KIX5']));
    expect(rowNames()).toEqual(['東瀛遊']);
    expect(screen.getByRole('status')).toHaveTextContent('連結內沒有可讀取的旅行團，以下是你自己的收藏。');
  });

  it('a browser that keeps nothing: says why, shows a link\'s tours without save buttons, and never navigates', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    render(<Page initial={savedHref(['egl:KIX5'])} />);
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('這個瀏覽器不讓本網站保存資料');
    // The link's note does not invite saving, which this browser cannot do.
    expect(screen.getAllByRole('status')[1]).toHaveTextContent(/^這個清單來自一個連結。$/);
    expect(rowNames()).toEqual(['東瀛遊']);
    expect(screen.queryByRole('button', { name: /收藏/ })).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.queryByText('未有收藏的旅行團。')).toBeNull();
  });

  it('storage full: the list, its count and 移除 stay; only a change fails, and the button says so', async () => {
    const user = userEvent.setup();
    store(['egl:GONE1', 'egl:KIX5'], { 'egl:GONE1': '東瀛遊：大阪，4日3夜' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    render(<Page initial={savedHref(['egl:KIX5', 'egl:GONE1'])} />);
    expect(rowNames()).toEqual(['東瀛遊']);
    expect(screen.getByRole('region', { name: '已不再列出' })).toHaveTextContent('東瀛遊：大阪，4日3夜');
    expect(screen.queryByText(/這個瀏覽器不讓本網站保存資料/)).toBeNull();
    await user.click(screen.getByRole('button', { name: /^收藏「東瀛遊/ }));
    expect(rowNames()).toEqual(['東瀛遊']);
    expect(screen.getByRole('button', { name: /^收藏「東瀛遊/ })).toHaveTextContent('空間已滿');
  });

  it('the server renders the address\'s tours and no line or 移除 for the ones no longer listed; hydration matches, with no warning', async () => {
    store(['egl:KIX5', 'jetour:THB', 'egl:GONE1'], { 'egl:GONE1': '東瀛遊：大阪，4日3夜' });
    const props = { asked: ['egl:GONE1', 'jetour:THB', 'egl:KIX5'], dropped: 0, tours: [B, A], operators, today: '2026-11-12' as const };
    const page = <I18nProvider locale="zh-Hant"><SavedConnected {...props} /></I18nProvider>;
    const html = renderToString(page);
    expect(html).toContain('捷旅');
    expect(html).not.toContain('已收藏');
    expect(html).not.toContain('未有收藏');
    expect(html).not.toContain('移除');
    expect(html).not.toContain('已不再列出');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => { root = hydrateRoot(container, page); });
    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(2);
    // After hydration, the visitor's own line with its label and 移除 appears (added, never taken away).
    expect(container).toHaveTextContent('東瀛遊：大阪，4日3夜');
    expect(router.replace).not.toHaveBeenCalled();
    act(() => root!.unmount());
    container.remove();
  });

  it('with no list in the address the server shows no state at all (no empty message that the browser would contradict)', () => {
    store(['egl:KIX5']);
    const html = renderToString(<I18nProvider locale="zh-Hant"><SavedConnected asked={[]} dropped={0} tours={[]} operators={operators} today="2026-11-12" /></I18nProvider>);
    expect(html).not.toContain('未有收藏');
    expect(html).toContain('<noscript>');
  });
});
