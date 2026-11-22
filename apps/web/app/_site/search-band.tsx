import { SiteLink } from '../../components/SiteLink';
import type { ReactNode } from 'react';
import type { T } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import type { SearchState } from '../../lib/search-params';
import { formatCount } from '../../lib/format';
import type { BandBox, BandRows } from '../../lib/band-rows';
import { DestinationPanelsConnected, DestinationSearchConnected } from '../../components/DestinationConnected';
import frame from './site-frame.module.css';
import styles from './search-band.module.css';

export interface SearchBandProps {
  t: T;
  /** The page's <h1>: the home page's headline, a destination's or a season's heading (日本旅行團). */
  heading: string;
  /** The line of real numbers beside it; nothing when the tours could not be read. */
  line?: ReactNode;
  /** The home page's line under them saying what the site does (band.lede); none elsewhere. */
  lede?: string;
  /** More under the heading: an operator's notes. */
  related?: ReactNode;
  /** The page's search state, for the destination box and the country button; none when the tours could not be read. */
  state?: SearchState;
  /** The two rows of boxes (lib/band-rows.ts): on the home page, a destination's and a season's; none elsewhere. */
  rows?: BandRows;
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

/**
 * A box: its name and count (one line box on wide screens, stacked on phones), and on a chosen box ✕ (after the count
 * on wide screens, in the top-right corner on phones; the filter bar's active-destination pill ends with the same mark).
 * A link, named as chosen when it is (band.selected: pressing it un-chooses it); a box with nothing to list is plain text,
 * faded, neither a link nor focusable.
 */
function Box({ t, box, kind }: { t: T; box: BandBox; kind: 'shortcut' | 'season' }) {
  const className = [styles[kind], box.chosen && styles.selected, box.path === null && styles.faded].filter(Boolean).join(' ');
  const text = (
    <span className={styles.boxText}>
      <span className={styles.name}>{box.name}</span>{' '}<BoxCount t={t} tours={box.tours} />
      {box.chosen && <span className={styles.clear} aria-hidden="true">✕</span>}
    </span>
  );
  if (box.path === null) return <span className={className}>{text}</span>;
  const name = box.chosen ? t('band.selected', { name: box.name, count: t('dest.tours', { n: formatCount(box.tours) }) }) : undefined;
  return <SiteLink className={className} href={localeHref(t.locale, box.path)} aria-label={name}>{text}</SiteLink>;
}

/** A row 1 box's visibility classes: four on phones; a chosen country's further regions only once opened. */
function whereItemClass(box: BandBox): string | undefined {
  const classes = [box.hideOnPhone && styles.hideOnPhone, box.moreOnPhone && styles.moreOnPhone, box.moreOnWide && styles.moreOnWide];
  return classes.filter(Boolean).join(' ') || undefined;
}

/**
 * The gold band under the header (mock-up Rows): the page's heading with its line of numbers, the destination search
 * box with the 按國家選擇 button, and, on the home page, a destination's page and a season's page, the two rows of boxes
 * (drawing W3): row 1 "where" (the destinations with the most tours, or a chosen country with its regions), row 2
 * "when" (the seasons with tours now). Each box chooses its destination or season and keeps the other row's choice; a
 * chosen box (white, ✕) un-chooses it. Spans the window; its content sits in the page's column.
 *
 * Phones (drawings Home3PhoneGrid "P1" and W3): the button under the search box, full width; each row under its own
 * label, as a grid (row 1: four columns, two in English; row 2: three, two in English), each name over its count with
 * its unit. The rows are navigation landmarks, each named by its label (row 1's is visible on phones only; on wide
 * screens it is visually hidden and still names the row). A chosen country with more regions than shown ends row 1
 * with a disclosure (native <details>, closed on every load) that shows the others in place.
 */
export function SearchBand({ t, heading, line, lede, related, state, rows }: SearchBandProps) {
  const more = rows?.where.moreRegions ?? null;
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
        {rows && rows.where.boxes.length > 0 && (
          <nav className={styles.shortcuts} aria-labelledby="band-where">
            <p id="band-where" className={`${styles.label} ${styles.whereLabel}`}>{rows.where.label}</p>
            <ul className={styles.shortcutList}>
              {rows.where.boxes.map(box => (
                <li key={box.key} className={whereItemClass(box)}>
                  <Box t={t} box={box} kind="shortcut" />
                </li>
              ))}
              {more && (
                // The boxes it shows are this list's own items, already in the HTML: it only stops hiding them.
                <li className={[styles.moreItem, !more.onWide && styles.hideOnWide, !more.onPhone && styles.hideOnPhone].filter(Boolean).join(' ')}>
                  <details className={styles.more}>
                    <summary>
                      <span className={styles.moreClosed}>{t('band.allRegions', { n: more.n })}</span>
                      <span className={styles.moreOpen}>{t('band.fewerRegions')}</span>
                    </summary>
                  </details>
                </li>
              )}
            </ul>
          </nav>
        )}
        {rows && rows.when.length > 0 && (
          <nav className={styles.seasons} aria-labelledby="band-seasons">
            <p id="band-seasons" className={styles.label}>{t('tours.seasons')}</p>
            <ul className={styles.seasonList}>
              {rows.when.map(box => (
                <li key={box.key}><Box t={t} box={box} kind="season" /></li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </section>
  );
}
