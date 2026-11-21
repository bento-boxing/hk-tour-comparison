'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { places, type IsoDate } from '@hktours/core';
import type { OperatorInfo } from '@hktours/db/read';
import type { TourRow } from '../lib/tour-row';
import { useT } from '../lib/i18n-client';
import { localeHref } from '../lib/locale-path';
import { chainStartHref } from '../lib/chain-href';
import { savedHref } from '../lib/saved-list';
import { getNoSavedTours, getSavedTours, newestFirst, subscribeSaved, unsaveTour } from '../lib/saved-tours';
import { Results } from './Results';
import { UpdatedNote } from './ListFooter';
import styles from './SavedConnected.module.css';

/** The same tours, in any order. */
const sameTours = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every(k => b.includes(k));

/**
 * The saved page's list (app/_site/saved-page.tsx renders the heading). The server renders the tours its address asks
 * for (`asked`: lib/saved-list.ts), and cannot know what this browser keeps; after hydration the page shows one of:
 *  - the visitor's own list: when the address asks for exactly the tours this browser keeps (in any order), for none,
 *    or for nothing readable. Shown newest saved first and kept in step with what is saved, here and in other tabs: the
 *    address is replaced (never pushed, so Back does not step through removals) with the browser's list, which is the
 *    one time the list is sent to the site. Removing a tour (its 已收藏, or 移除 for one no longer listed) takes it away
 *    at once and moves focus to the next one, or to the empty state's heading;
 *  - a list that came in a link: shown as it is, said to be a link's, with a link to the visitor's own list when they
 *    have one; each row's 收藏 adds it to theirs. Its tours that are no longer listed are only counted: nothing taken
 *    from the address is ever shown;
 *  - nothing saved: two lines on what saving does, and a link to the search;
 *  - a browser that keeps nothing: why nothing can be saved here.
 * A saved tour that is no longer listed is shown by the label kept when it was saved (operator, places, length: the
 * site's own text, never a tour code), with 移除. The server shows no such line and no 移除 (it cannot know the labels or
 * whose list it is), so nothing it draws is taken away after hydration.
 */
export function SavedConnected({ asked, dropped, tours, operators, today, now }: {
  asked: string[]; dropped: number; tours: TourRow[]; operators: OperatorInfo[]; today: IsoDate;
  /** The server's time of this render (ISO), for the rows' old-data warning. */
  now?: string;
}) {
  const t = useT();
  const router = useRouter();
  const saved = useSyncExternalStore(subscribeSaved, getSavedTours, getNoSavedTours);
  const own = saved?.available ? newestFirst(saved) : null;
  const ownText = own?.join(',') ?? null;
  const askedText = asked.join(',');

  // The address this page last put the own list in, and the first address's state (it may have held nothing readable).
  const replacedTo = useRef<string | null>(null);
  const [ownFor, setOwnFor] = useState<string | null>(null);
  const [linkHeldNothing] = useState(asked.length === 0 && dropped > 0);

  // Decided as soon as the browser's list is read, without waiting a render: an address this page put the own list in
  // (or one it was showing as the own list) stays the own list while the list changes and the new address loads, so
  // nothing in between flips to a link's list or flashes an empty state.
  const mode = saved === null ? null
    : asked.length === 0 || (own !== null && sameTours(own, asked)) || ownFor === askedText || replacedTo.current === askedText
      ? 'own' : 'link';
  useEffect(() => {
    if (mode === 'own' && ownFor !== askedText) setOwnFor(askedText);
  }, [mode, ownFor, askedText]);

  useEffect(() => {
    if (mode !== 'own' || ownText === null || ownText === askedText) return;
    const keys = ownText === '' ? [] : ownText.split(',');
    replacedTo.current = keys.join(',');
    router.replace(localeHref(t.locale, savedHref(keys)), { scroll: false });
  }, [mode, ownText, askedText, router, t.locale]);

  // Removing takes the row (or line) and the focused button away: focus goes to the next one, or the empty heading.
  const listRef = useRef<HTMLDivElement>(null);
  const removedAt = useRef<number | null>(null);
  const noteRemoval = (e: MouseEvent) => {
    const button = e.target instanceof Element ? e.target.closest('button[aria-pressed="true"], button[data-remove]') : null;
    if (!button) return;
    const row = button.closest('[role="row"]');
    removedAt.current = row ? [...(listRef.current?.querySelectorAll('[role="row"]') ?? [])].indexOf(row) : -1;
  };

  const byKey = new Map(tours.map(tour => [tour.key, tour]));
  const askedSet = new Set(asked);
  // The own list may hold a tour the address does not ask for yet (saved a moment ago): it shows once the server has it.
  const keys = mode === 'own' && own !== null ? own : asked;
  const rows = keys.flatMap(key => byKey.get(key) ?? []);
  const gone = keys.filter(key => askedSet.has(key) && !byKey.has(key));
  const labels = new Map(saved?.tours.map(s => [s.key, s.label]) ?? []);
  const empty = mode === 'own' && own !== null && own.length === 0;

  useEffect(() => {
    const at = removedAt.current;
    if (at === null || (document.activeElement && document.activeElement !== document.body)) return;
    removedAt.current = null;
    const rowsNow = [...(listRef.current?.querySelectorAll('[role="row"]') ?? [])].filter(r => r.querySelector('[role="cell"]'));
    const target = (at >= 0 ? rowsNow[Math.min(at, rowsNow.length - 1)]?.querySelector<HTMLElement>('button[aria-pressed]') : null)
      ?? listRef.current?.querySelector<HTMLElement>('button[data-remove]')
      ?? listRef.current?.querySelector<HTMLElement>('[data-focus-after-removal]');
    target?.focus();
  }, [rows.length, gone.length, empty]);

  return (
    <div ref={listRef} onClickCapture={noteRemoval}>
      {saved?.available === false && <p className={styles.notice} role="status">{t('saved.unavailable')}</p>}
      {mode === 'own' && linkHeldNothing && <p className={styles.notice} role="status">{t('saved.nothingReadable')}</p>}
      {mode === 'link' && (
        <p className={styles.notice} role="status">
          {/* Where nothing can be saved, the note does not invite saving. */}
          {t(own !== null ? 'saved.fromLink' : 'saved.fromLinkOnly')}
          {own !== null && own.length > 0 && (
            <>
              {' '}
              {/* Plain /saved, never prefetched: the visitor's list is sent only when they open it. */}
              <Link href={localeHref(t.locale, '/saved')} prefetch={false} className={`${styles.link} ${styles.yours}`}>{t('saved.yours', { n: own.length })}</Link>
            </>
          )}
        </p>
      )}
      {dropped > 0 && asked.length > 0 && <p className={styles.notice} role="status">{t('saved.dropped')}</p>}
      {mode === null && asked.length === 0 && <noscript><p className={styles.notice}>{t('saved.noscript')}</p></noscript>}

      {empty && (
        <div className={styles.empty}>
          <h2 className={styles.emptyText} tabIndex={-1} data-focus-after-removal="">{t('saved.empty')}</h2>
          <p className={styles.emptyHow}>{t('saved.emptyHow')}</p>
          <Link href={localeHref(t.locale, '/')} className={styles.link}>{t('nav.search')}</Link>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <Results
            tours={rows} total={rows.length} operators={operators} places={places} today={today} now={now} t={t}
            onAdd={(tour, departure) => router.push(localeHref(t.locale, chainStartHref(tour.key, departure)))}
          />
          <UpdatedNote operators={operators} t={t} />
        </>
      )}

      {mode === 'own' && gone.length > 0 && (
        <section aria-labelledby="saved-gone" className={styles.gone}>
          <h2 id="saved-gone" className={styles.goneHeading} tabIndex={-1} data-focus-after-removal="">{t('saved.goneHeading')}</h2>
          <p className={styles.goneNote}>{t('saved.goneNote')}</p>
          <ul className={styles.goneList}>
            {gone.map(key => {
              const label = labels.get(key) ?? t('saved.goneUnnamed');
              return (
                <li key={key} className={styles.goneItem}>
                  <span className={styles.goneLabel}><span className={styles.goneText}>{label}</span></span>
                  <button
                    type="button" className={styles.remove} data-remove=""
                    aria-label={t('saved.removeName', { tour: label })}
                    onClick={() => unsaveTour(key)}
                  >
                    {t('saved.remove')}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {mode === 'link' && gone.length > 0 && <p className={styles.goneCount}>{t('saved.goneCount', { n: gone.length })}</p>}
    </div>
  );
}
