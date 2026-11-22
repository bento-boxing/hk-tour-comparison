'use client';

import { useSyncExternalStore } from 'react';
import { SiteLink } from './SiteLink';
import type { T } from '../lib/i18n';
import { localeHref } from '../lib/locale-path';
import { SAVED_CAP } from '../lib/saved-list';
import { getNoSavedTours, getSavedTours, subscribeSaved } from '../lib/saved-tours';
import { useRememberedTrip } from '../lib/remembered-trip';
import { LanguageSwitch } from './LanguageSwitch';
import { Mark } from './Mark';
import { ThemeSwitch } from './ThemeSwitch';
import styles from './NavBar.module.css';

export type NavPage = 'search' | 'chain' | 'saved';

/**
 * The pages' paths without a language; each link gets the bar's language (localeHref). The destinations index has no
 * link here (task 58): people choose with the picker and the band's shortcuts; the footer and the band link to it.
 */
const links: { page: NavPage; path: string; label: 'nav.search' | 'nav.chain' }[] = [
  { page: 'search', path: '/', label: 'nav.search' },
  { page: 'chain', path: '/chain', label: 'nav.chain' },
];

/**
 * 已收藏 (N): the saved page, with the number of tours this browser has saved. The link is always plain /saved and is
 * never prefetched: the list stays in the browser until the visitor opens that page (which then reads it). The server
 * cannot know the number, so it renders the link without one and the number appears after hydration. Nothing moves
 * when it does: the link is laid out as wide as '已收藏 (100)' (the most a browser saves; a hidden copy stacked under
 * the text), while the visible text, and with it the hover and current-page underline, is only as wide as itself.
 */
function SavedLink({ current, t }: { current: boolean; t: T }) {
  const saved = useSyncExternalStore(subscribeSaved, getSavedTours, getNoSavedTours);
  const count = saved?.available ? saved.tours.length : null;
  return (
    <SiteLink
      href={localeHref(t.locale, '/saved')}
      prefetch={false}
      className={`${styles.link} ${styles.savedLink}${current ? ` ${styles.current}` : ''}`}
      aria-current={current ? 'page' : undefined}
    >
      <span className={styles.savedStack}>
        <span className={styles.savedText}>
          <span>{t('nav.saved')}{count !== null && <> <span className={styles.count}>{t('nav.savedCount', { n: count })}</span></>}</span>
        </span>
        <span className={styles.savedRoom} aria-hidden="true">{t('nav.saved')} {t('nav.savedCount', { n: SAVED_CAP })}</span>
      </span>
    </SiteLink>
  );
}

/**
 * The site's header bar (mock-up Rows; the saved link from RowsB13): the mark and name (a link to the search page), the
 * two page links and 已收藏 (N) (in the bar's language, the current one bold with a gold underline), then the
 * language and theme switches at the right. The bar is ink in the light theme and near-black in the dark one. On a
 * phone the name and the switches come first, then the three links on one line.
 * `current` is the page whose link is highlighted, if any. 連續行程 goes to the trip this browser remembers (task 71:
 * lib/remembered-trip), once hydrated; before that, and with none, to /chain, which then goes to it.
 */
export function NavBar({ current, t }: { current?: NavPage; t: T }) {
  const trip = useRememberedTrip();
  return (
    <nav className={styles.bar}>
      <div className={styles.inner}>
        <SiteLink href={localeHref(t.locale, '/')} className={styles.name}><Mark className={styles.mark} />{t('site.name')}</SiteLink>
        <div className={styles.links}>
          {links.map(({ page, path, label }) => (
            <SiteLink
              key={page}
              href={localeHref(t.locale, page === 'chain' ? trip?.path ?? path : path)}
              className={page === current ? `${styles.link} ${styles.current}` : styles.link}
              aria-current={page === current ? 'page' : undefined}
            >
              {t(label)}
            </SiteLink>
          ))}
          <SavedLink current={current === 'saved'} t={t} />
        </div>
        <div className={styles.tools}>
          <LanguageSwitch t={t} />
          <ThemeSwitch t={t} />
        </div>
      </div>
    </nav>
  );
}
