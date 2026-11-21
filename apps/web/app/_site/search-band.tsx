import Link from 'next/link';
import type { ReactNode } from 'react';
import { places, type Destination } from '@hktours/core';
import type { ListedCount } from '@hktours/db/read';
import type { T } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import type { SearchState } from '../../lib/search-params';
import { TOURS_PATH, destinationName, destinationPath } from '../../lib/destinations';
import { formatCount } from '../../lib/format';
import { DestinationPanelsConnected, DestinationSearchConnected } from '../../components/DestinationConnected';
import frame from './site-frame.module.css';
import styles from './search-band.module.css';

export interface SearchBandProps {
  t: T;
  /** The page's <h1>: the home page's headline, or a destination's heading (日本旅行團). */
  heading: string;
  /** The line of real numbers beside it; nothing when the tours could not be read. */
  line?: ReactNode;
  /** More under the heading: a destination's links to its regions or its country. */
  related?: ReactNode;
  /** The page's search state, for the destination box and the country button; none when the tours could not be read. */
  state?: SearchState;
  /** The destinations offered as shortcuts (lib/destinations.ts topDestinations), then a link to the index. */
  shortcuts?: { destination: Destination; count: ListedCount }[];
}

/**
 * The gold band under the header on the home page and on a destination's page (mock-up Rows): the page's heading
 * with its line of numbers, the destination search box with the 按國家選擇 button, and a row of boxes linking to the
 * destinations with the most tours now (the owner's drawing E1), ending with a text link to the destinations index.
 * Spans the window; its content sits in the page's column.
 */
export function SearchBand({ t, heading, line, related, state, shortcuts }: SearchBandProps) {
  return (
    <section className={styles.band} aria-labelledby="page-heading">
      <div className={`${frame.wrap} ${styles.inner}`}>
        <div className={styles.head}>
          <h1 id="page-heading" className={styles.heading}>{heading}</h1>
          {line && <p className={styles.line}>{line}</p>}
        </div>
        {related}
        {state && (
          <div className={styles.searchRow}>
            <div className={styles.searchBox}><DestinationSearchConnected state={state} placeholder={t('band.placeholder')} /></div>
            <DestinationPanelsConnected state={state} />
          </div>
        )}
        {shortcuts && (
          <nav className={styles.shortcuts} aria-label={t('band.shortcuts')}>
            <ul className={styles.shortcutList}>
              {shortcuts.map(({ destination, count }) => (
                <li key={destinationPath(destination)}>
                  <Link className={styles.shortcut} href={localeHref(t.locale, destinationPath(destination))}>
                    {/* One line box, so the name and its smaller count share a baseline. */}
                    <span>
                      {destinationName(destination, places, t)}
                      {' '}<span className={styles.count}>{formatCount(count.tours)}</span>
                    </span>
                  </Link>
                </li>
              ))}
              <li>
                <Link className={styles.all} href={localeHref(t.locale, TOURS_PATH)}>{t('band.allDestinations')}</Link>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </section>
  );
}
