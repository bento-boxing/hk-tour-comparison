'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { SiteLink } from './SiteLink';
import type { T } from '../lib/i18n';
import { useT } from '../lib/i18n-client';
import { localeHref, splitLocalePath } from '../lib/locale-path';
import { getNoSavedTours, getSavedTours, subscribeSaved } from '../lib/saved-tours';
import { useRememberedTrip } from '../lib/remembered-trip';
import styles from './TabBar.module.css';

export type Tab = 'search' | 'chain' | 'saved';

/**
 * The tab a path belongs to, whatever its language: the search page and every page that is a search with something
 * chosen (a destination, a season, an operator, a search address) are 搜尋; the trip page is 連續行程; the saved page
 * 已收藏. The indexes (/tours, /operators) and the about page belong to none.
 */
export function tabFor(pathname: string): Tab | undefined {
  const { path } = splitLocalePath(pathname);
  if (path === '/' || path === '/q' || /^\/(tours|seasons|operators)\/[^/]/.test(path)) return 'search';
  if (path === '/chain' || path.startsWith('/chain/')) return 'chain';
  if (path === '/saved') return 'saved';
  return undefined;
}

// A page that is none of the tabs' though its address looks like one (a not-found page under /tours/…) says so with
// NoCurrentTab: while it is shown, no tab is marked. Browser-side: the server marks by the address alone.
let unmarkers = 0;
const unmarkListeners = new Set<() => void>();
const subscribeUnmarked = (listener: () => void) => { unmarkListeners.add(listener); return () => { unmarkListeners.delete(listener); }; };
const setUnmarkers = (n: number) => { unmarkers = n; for (const listener of unmarkListeners) listener(); };

/** Rendered by a page that belongs to no tab (the not-found page): no tab is current while it is shown. */
export function NoCurrentTab() {
  useEffect(() => {
    setUnmarkers(unmarkers + 1);
    return () => setUnmarkers(unmarkers - 1);
  }, []);
  return null;
}

/** How far (px) the page must scroll one way before the bar slides away or back, so a jitter moves nothing. */
export const SCROLL_STEP = 8;

/** The icons (24px, stroked in the tab's text colour): a magnifier, one leg after another, a star. */
const ICONS: Record<Tab, string> = {
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13ZM15.2 15.2L20 20',
  chain: 'M3 8h10M10 5l3 3l-3 3M21 16H11M14 13l-3 3l3 3',
  saved: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.8Z',
};

/**
 * The bottom bar on phones (under 640px; the owner's drawings Mobile6Home to Mobile21Saved): fixed to the window's
 * foot, 56px plus the device's bottom safe area: 搜尋, 連續行程 and 已收藏, each an icon over its name, the current one
 * marked (a gold top edge, the header's text colour, bold) with aria-current="page". Real links (SiteLink), so it
 * works without JavaScript.
 *
 * Badges: the tours in the trip this browser remembers (lib/remembered-trip, task 71) and the tours saved in this
 * browser. Both are the browser's to know, so they appear after hydration; each is drawn out of the layout (absolute,
 * over the icon's corner), so nothing moves when it appears or changes. Read out after the tab's name: '已收藏 (2)'.
 * 連續行程 goes to the remembered trip, once hydrated (before that, and with none, to /chain, which then goes to it).
 *
 * It slides away while the visitor scrolls down and comes back when they scroll up, at the top of the page, and when
 * focus moves into it. One passive scroll listener, read at most once a frame; the slide is a transform (no layout),
 * instant with reduced motion. With JavaScript off it simply stays.
 *
 * A spacer of the bar's height ends the page, so nothing ends up behind the bar, the footer included. From 640px,
 * and on a phone turned sideways with a short screen (landscape, at most 500px tall: the header shows the page links
 * there instead), neither is drawn.
 */
export function TabBar({ t }: { t: T }) {
  const pathname = usePathname();
  const unmarked = useSyncExternalStore(subscribeUnmarked, () => unmarkers > 0, () => false);
  const current = unmarked ? undefined : tabFor(pathname);
  const barRef = useRef<HTMLElement>(null);
  const trip = useRememberedTrip();
  const saved = useSyncExternalStore(subscribeSaved, getSavedTours, getNoSavedTours);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    let last = Math.max(window.scrollY, 0);
    let frame = 0;
    const show = (shown: boolean) => bar.toggleAttribute('data-hidden', !shown);
    const read = () => {
      frame = 0;
      const y = Math.max(window.scrollY, 0);
      if (y === 0 || bar.contains(document.activeElement)) { show(true); last = y; return; }
      if (Math.abs(y - last) < SCROLL_STEP) return;
      show(y < last);
      last = y;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    const onFocus = () => show(true);
    window.addEventListener('scroll', onScroll, { passive: true });
    bar.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('scroll', onScroll);
      bar.removeEventListener('focusin', onFocus);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Each page starts with the bar shown.
  useEffect(() => { barRef.current?.removeAttribute('data-hidden'); }, [pathname]);

  const tab = (name: Tab, path: string, label: string, n: number) => (
    <li className={styles.item}>
      <SiteLink
        href={localeHref(t.locale, path)}
        className={styles.tab}
        aria-current={current === name ? 'page' : undefined}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.icon}><path d={ICONS[name]} /></svg>
        <span className={styles.label}>{label}</span>
        {n > 0 && (
          <>
            <span className={styles.badge} aria-hidden="true">{n}</span>
            {' '}
            <span className={styles.visuallyHidden}>{t('tabs.count', { n })}</span>
          </>
        )}
      </SiteLink>
    </li>
  );

  return (
    <>
      <div className={styles.spacer} aria-hidden="true" />
      <nav ref={barRef} aria-label={t('tabs.label')} className={styles.bar}>
        <ul className={styles.list}>
          {tab('search', '/', t('tabs.search'), 0)}
          {tab('chain', trip?.path ?? '/chain', t('nav.chain'), trip?.count ?? 0)}
          {tab('saved', '/saved', t('nav.saved'), saved?.available ? saved.tours.length : 0)}
        </ul>
      </nav>
    </>
  );
}

/** The bar for the root layout (a server component cannot pass `t`, a function, to a client one). */
export function SiteTabBar() {
  return <TabBar t={useT()} />;
}
