import { SiteLink } from '../../components/SiteLink';
import type { ReactNode } from 'react';
import { places, type Destination } from '@hktours/core';
import type { ListedCount } from '@hktours/db/read';
import type { T } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import type { SearchState } from '../../lib/search-params';
import { TOURS_PATH, destinationName, destinationPath } from '../../lib/destinations';
import { formatCount } from '../../lib/format';
import { SEASON_NAME_KEYS, seasonPath } from '../../lib/seasons';
import type { SeasonCount } from '../../lib/season-counts';
import { DestinationPanelsConnected, DestinationSearchConnected } from '../../components/DestinationConnected';
import frame from './site-frame.module.css';
import styles from './search-band.module.css';

export interface SearchBandProps {
  t: T;
  /** The page's <h1>: the home page's headline, or a destination's heading (日本旅行團). */
  heading: string;
  /** The line of real numbers beside it; nothing when the tours could not be read. */
  line?: ReactNode;
  /** The home page's line under them saying what the site does (band.lede); none elsewhere. */
  lede?: string;
  /** More under the heading: a destination's links to its regions or its country. */
  related?: ReactNode;
  /** The page's search state, for the destination box and the country button; none when the tours could not be read. */
  state?: SearchState;
  /** The destinations offered as shortcuts (lib/destinations.ts topDestinations), then a link to the index. */
  shortcuts?: { destination: Destination; count: ListedCount }[];
  /**
   * The seasons' current windows with their tours (lib/season-counts.ts): those with tours get a box each, under the
   * shortcuts, in the calendar order of their windows. Shown only with the shortcuts.
   */
  seasons?: SeasonCount[];
}

/**
 * A box's count with its unit ('1,463 團', '1,463 tours': dest.tours). The number always shows; the unit shows on
 * phones (the count under the name) and is visually hidden on wide screens (the number beside the name, as drawn),
 * where screen readers still read it with the number.
 */
function BoxCount({ t, tours }: { t: T; tours: number }) {
  const n = formatCount(tours);
  const text = t('dest.tours', { n });
  const at = text.indexOf(n);
  const [before, after] = at < 0 ? ['', ''] : [text.slice(0, at), text.slice(at + n.length)];
  // The space between the number and its unit stays outside the hidden part, so every reader keeps it.
  const space = /^\s*/.exec(after)![0];
  return (
    <span className={styles.count}>
      {before && <span className={styles.unit}>{before}</span>}{n}{space}{after.trim() && <span className={styles.unit}>{after.slice(space.length)}</span>}
    </span>
  );
}

/** A box's text: one line box on wide screens (the name and its smaller count share a baseline), stacked on phones. */
function BoxText({ t, name, tours }: { t: T; name: string; tours: number }) {
  return (
    <span className={styles.boxText}>
      <span className={styles.name}>{name}</span>{' '}<BoxCount t={t} tours={tours} />
    </span>
  );
}

/**
 * The gold band under the header on the home page and on a destination's page (mock-up Rows): the page's heading
 * with its line of numbers, the destination search box with the 按國家選擇 button, and a row of boxes linking to the
 * destinations with the most tours now (the owner's drawing E1), ending with a text link to the destinations index;
 * under them, the seasons with tours now as outlined boxes (drawing Home2 "B"). Spans the window; its content sits in
 * the page's column.
 *
 * Phones (drawing Home3PhoneGrid "P1"): the button under the search box, full width; a label row (熱門目的地, and the
 * link to the index at its right, in the same row and wrapping under it when the text is large), the first four destinations in four equal columns (English: two, as its names are
 * too long for four: search-band.module.css), each name over its count with its unit; then the
 * seasons' label and their boxes in three equal columns (English: two). The two rows are navigation landmarks, each named by its
 * own label (熱門目的地 is visible on phones only; on wide screens it is visually hidden and still names the row).
 */
export function SearchBand({ t, heading, line, lede, related, state, shortcuts, seasons }: SearchBandProps) {
  // Only seasons with tours, soonest first (a season rolled forward to next year comes after the others).
  const seasonBoxes = shortcuts && seasons
    ? seasons.filter(s => s.count.tours > 0).sort((a, b) => (a.window.from < b.window.from ? -1 : a.window.from > b.window.from ? 1 : 0))
    : [];
  return (
    <section className={styles.band} aria-labelledby="page-heading">
      <div className={`${frame.wrap} ${styles.inner}`}>
        <div className={styles.head}>
          <h1 id="page-heading" className={styles.heading}>{heading}</h1>
          {line && <p className={styles.line}>{line}</p>}
          {lede && <p className={styles.lede}>{lede}</p>}
        </div>
        {related}
        {state && (
          <div className={styles.searchRow}>
            <div className={styles.searchBox}><DestinationSearchConnected state={state} placeholder={t('band.placeholder')} /></div>
            <div className={styles.panelsBox}><DestinationPanelsConnected state={state} /></div>
          </div>
        )}
        {shortcuts && (
          <nav className={styles.shortcuts} aria-labelledby="band-popular">
            {/*
              * The label, and on phones the link to the index beside it (before the boxes, as it is seen there). Wide
              * screens show the link after the boxes instead (the list's last item); each placement is display: none
              * at the other widths, so only one is ever in the accessibility tree.
              */}
            <div className={styles.labelRow}>
              <p id="band-popular" className={`${styles.label} ${styles.popularLabel}`}>{t('band.popular')}</p>
              <SiteLink className={`${styles.all} ${styles.phoneAll}`} href={localeHref(t.locale, TOURS_PATH)}>{t('band.allDestinations')}</SiteLink>
            </div>
            <ul className={styles.shortcutList}>
              {shortcuts.map(({ destination, count }) => (
                <li key={destinationPath(destination)}>
                  <SiteLink className={styles.shortcut} href={localeHref(t.locale, destinationPath(destination))}>
                    <BoxText t={t} name={destinationName(destination, places, t)} tours={count.tours} />
                  </SiteLink>
                </li>
              ))}
              <li className={styles.allItem}>
                <SiteLink className={styles.all} href={localeHref(t.locale, TOURS_PATH)}>{t('band.allDestinations')}</SiteLink>
              </li>
            </ul>
          </nav>
        )}
        {seasonBoxes.length > 0 && (
          <nav className={styles.seasons} aria-labelledby="band-seasons">
            <p id="band-seasons" className={styles.label}>{t('tours.seasons')}</p>
            <ul className={styles.seasonList}>
              {seasonBoxes.map(({ window, count }) => (
                <li key={window.season}>
                  <SiteLink className={styles.season} href={localeHref(t.locale, seasonPath(window.season))}>
                    <BoxText t={t} name={t(SEASON_NAME_KEYS[window.season].name)} tours={count.tours} />
                  </SiteLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </section>
  );
}
