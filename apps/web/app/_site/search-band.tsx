import { SiteLink } from '../../components/SiteLink';
import type { ReactNode } from 'react';
import type { T } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import type { SearchState } from '../../lib/search-params';
import { formatCount } from '../../lib/format';
import type { BandBox, BandDates, BandRows } from '../../lib/band-rows';
import type { ScreenData } from '../../lib/search-screen';
import { DestinationPanelsConnected, DestinationScreenConnected, DestinationSearchConnected } from '../../components/DestinationConnected';
import { BandDateFieldConnected } from '../../components/DateFieldConnected';
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
  /** The phone search screen's popular destinations and counts, where there are no rows (an operator's page). */
  screen?: ScreenData;
  /** The phone's 幾時出發？ field and its sheet (task 78: lib/band-rows.ts bandDates); with rows only. */
  dates?: BandDates;
}

/**
 * A box's count with its unit ('1,463 團', '1,463 tours': dest.tours). The number always shows, beside the name as
 * drawn; the unit is visually hidden (at both widths since task 73), and screen readers still read it with the number.
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
 * A box on wide screens: its name and count on one line, and on a chosen box ✕ after the count (the filter bar's
 * active-destination pill ends with the same mark).
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

/** A row 1 box's visibility class on wide screens: a chosen country's further regions only once opened. */
function whereItemClass(box: BandBox): string | undefined {
  return box.moreOnWide ? styles.moreOnWide : undefined;
}

/**
 * A region's box on phones (task 73, drawings Mobile6Home and Mobile4Results), not chosen (the chosen one is a chip:
 * PhoneChips). One line, 40px tall, its name and count side by side (the count's unit for screen readers only); a name
 * too long for its column wraps inside the box, the count after it or under it, and the box grows. A link, or faded
 * plain text, as on wide screens.
 */
function PhoneBox({ t, box }: { t: T; box: BandBox }) {
  const className = [styles.pbox, styles.pregion, box.path === null && styles.faded].filter(Boolean).join(' ');
  const text = <><span className={styles.pname}>{box.name}</span>{' '}<BoxCount t={t} tours={box.tours} /></>;
  if (box.path === null) return <span className={className}>{text}</span>;
  return <SiteLink className={className} href={localeHref(t.locale, box.path)}>{text}</SiteLink>;
}

/** A chip: its name, where its ✕ goes (a path without a language), and its accessible name. */
export interface PhoneChip { key: string; name: string; path: string; label: string }

/** The band's chips from its rows (task 77): named band.selected, with the count, as the chosen boxes are. */
export function bandChips(t: T, boxes: BandBox[]): PhoneChip[] {
  return boxes.map(box => ({
    key: box.key, name: box.name, path: box.path!,
    label: t('band.selected', { name: box.name, count: t('dest.tours', { n: formatCount(box.tours) }) }),
  }));
}

/**
 * The chosen country and region on phones (task 77; task 78 also on the trip's choosing screen): one row of chips as
 * wide as their names, white with an ink border and ring, ✕ after the name (the count is in the heading's line;
 * screen readers hear the chip's label), 40px tall and 44px to touch. Pressing one un-chooses it. Phones only.
 */
export function PhoneChips({ t, chips }: { t: T; chips: PhoneChip[] }) {
  if (chips.length === 0) return null;
  return (
    <ul className={`${styles.pchips} ${styles.phoneOnly}`} aria-label={t('band.chosen')}>
      {chips.map(chip => (
        <li key={chip.key}>
          <SiteLink className={styles.pchip} href={localeHref(t.locale, chip.path)} aria-label={chip.label}>
            <span className={styles.pname}>{chip.name}</span>
            <span className={styles.pclear} aria-hidden="true">✕</span>
          </SiteLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * The band's boxes on phones (task 73; the owner's drawings Mobile6Home, Mobile4Results and M25), from the same rows
 * as wide screens (the same boxes, counts, fading and addresses): first the destination's choices as chips (task 77:
 * the country, the region, as wide as their names, wrapping only when they do not fit); then, with a country (or one
 * of its regions) chosen, its other regions (four columns: the first three, and 全部 {n} ▾ to show the rest in place,
 * unless four fit; two in English). No other destination boxes: they are on the search screen; and no festival boxes
 * or festival chip: the date field under these holds the dates (task 78).
 */
function PhoneRows({ t, rows }: { t: T; rows: BandRows }) {
  const chosen = rows.chips;
  const regions = rows.where.regions ? rows.where.boxes.slice(1).filter(b => !b.chosen) : [];
  const more = rows.where.moreRegions?.onPhone ? rows.where.moreRegions : null;
  if (chosen.length === 0 && regions.length === 0) return null;
  return (
    <div className={`${styles.phoneOnly} ${styles.phoneRows}`}>
      <PhoneChips t={t} chips={bandChips(t, chosen)} />
      {regions.length > 0 && (
        <ul className={`${styles.prow} ${styles.pregionRow}`} aria-label={rows.where.label}>
          {regions.filter(b => !b.moreOnPhone).map(box => <li key={box.key}><PhoneBox t={t} box={box} /></li>)}
          {more && (
            // The boxes it shows are this list's own items, already in the HTML: it only stops hiding them.
            <li>
              <details className={styles.pmore}>
                <summary className={styles.pbox}>
                  <span className={styles.moreClosed}>
                    <span aria-hidden="true">{t('band.allRegionsShort', { n: more.n })}{'\u00a0'}<span className={styles.pmark}>▾</span></span>
                    <span className={styles.srOnly}>{t('band.allRegions', { n: more.n })}</span>
                  </span>
                  <span className={styles.moreOpen}>{t('band.fewerRegions')}<span aria-hidden="true">{'\u00a0'}<span className={styles.pmark}>▴</span></span></span>
                </summary>
              </details>
            </li>
          )}
          {regions.filter(b => b.moreOnPhone).map(box => (
            <li key={box.key} className={styles.pmoreItem}><PhoneBox t={t} box={box} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The gold band under the header (mock-up Rows): the page's heading with its line of numbers, the destination search
 * box with the 按國家選擇 button, and, on the home page, a destination's page and a season's page, the two rows of boxes
 * (drawing W3): row 1 "where" (the destinations with the most tours, or a chosen country with its regions), row 2
 * "when" (the seasons with tours now). Each box chooses its destination or season and keeps the other row's choice; a
 * chosen box (white, ✕) un-chooses it. Spans the window; its content sits in the page's column.
 *
 * The rows are navigation landmarks, each named by its label (row 1's visually hidden). A chosen country with more
 * regions than shown ends row 1 with a disclosure (native <details>, closed on every load) that shows the others in place.
 *
 * Phones (task 73: under 1024px the wide search row and rows are not drawn, nor the home page's sentence): a compact
 * band: the heading over its line, the search box that opens the full-screen search (DestinationScreen; without
 * JavaScript a link to the destinations directory), then the same boxes in rows of their own (PhoneRows). An operator's
 * page has no rows; its search screen gets the popular destinations without counts (`screen`).
 */
export function SearchBand({ t, heading, line, lede, related, state, rows, screen, dates }: SearchBandProps) {
  const more = rows?.where.moreRegions?.onWide ? rows.where.moreRegions : null;
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
          <div className={`${styles.searchRow} ${styles.wideOnly}`}>
            <div className={styles.searchBox}><DestinationSearchConnected state={state} placeholder={t('band.placeholder')} /></div>
            <div className={styles.panelsBox}><DestinationPanelsConnected state={state} /></div>
          </div>
        )}
        {state && (
          <div className={styles.phoneOnly}>
            <DestinationScreenConnected state={state} screen={rows?.screen ?? screen} placeholder={t('band.placeholder')} />
          </div>
        )}
        {rows && <PhoneRows t={t} rows={rows} />}
        {state && dates && <div className={styles.phoneOnly}><BandDateFieldConnected state={state} dates={dates} /></div>}
        {rows && rows.where.boxes.length > 0 && (
          <nav className={`${styles.shortcuts} ${styles.wideOnly}`} aria-labelledby="band-where">
            <p id="band-where" className={`${styles.label} ${styles.whereLabel}`}>{rows.where.label}</p>
            <ul className={styles.shortcutList}>
              {rows.where.boxes.map(box => (
                <li key={box.key} className={whereItemClass(box)}>
                  <Box t={t} box={box} kind="shortcut" />
                </li>
              ))}
              {more && (
                // The boxes it shows are this list's own items, already in the HTML: it only stops hiding them.
                <li className={styles.moreItem}>
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
          <nav className={`${styles.seasons} ${styles.wideOnly}`} aria-labelledby="band-seasons">
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
