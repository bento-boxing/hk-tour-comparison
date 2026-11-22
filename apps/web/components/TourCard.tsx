'use client';

import {
  Fragment, useId, useRef, useState, useSyncExternalStore,
  type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent,
} from 'react';
import { isIsoDate, type IsoDate, type PlacesIndex } from '@hktours/core';
import type { OperatorInfo } from '@hktours/db';
import type { TourRow } from '../lib/tour-row';
import type { T } from '../lib/i18n';
import { operatorTextTone } from '../lib/contrast';
import { chipDay, formatLength, formatPrice } from '../lib/format';
import {
  departureDateText, departurePrice, priceChangeText, regionParts, routeNames, staleSince, startNote,
} from '../lib/card-text';
import { getNoOpenedTours, getOpenedTours, recordOpened, subscribeOpened } from '../lib/opened-tours';
import { getNoSavedTours, getSavedTours, saveTour, subscribeSaved, unsaveTour } from '../lib/saved-tours';
import { useUpcomingAfter } from '../lib/browser-today';
import { operatorName } from '../lib/place-names';
import { DeparturePicker, type PickerCloseReason } from './DeparturePicker';
import { PriceWithFrom } from './PriceWithFrom';
import styles from './TourCard.module.css';

export interface TourCardProps {
  tour: TourRow; operator: OperatorInfo; places: PlacesIndex; today: IsoDate; t: T;
  /**
   * The server's time of this render (ISO): a row is marked when its operator's data is older than 36 hours
   * (lib/card-text.ts staleSince). Without it, nothing is marked.
   */
  now?: string;
  /** When given, the 加入行程 button is shown and calls this with the chosen date. */
  onAdd?: (departure: IsoDate) => void;
  footNote?: string;   // shown under the region, e.g. '休息 1–2 日後出發' on the chain page
}

/** The date cells: three by two. A tour with more dates shows the first five and counts the rest in the sixth. */
export const DATE_CELLS = 6;

/** Only an absolute https address becomes a link; anything else (javascript:, data:, http:, relative) does not. */
const LINKABLE_URL = /^https:\/\//i;
/** Only #rrggbb reaches the inline style; anything else could carry other declarations. */
const SAFE_COLOR = /^#[0-9a-f]{6}$/i;
const FALLBACK_COLOR = 'var(--op-fallback)';
/** How close a date's tooltip may come to the window's left or right edge, in px. */
const TIP_MARGIN = 8;

/** Runs a formatter that may throw on bad data; null instead, so one bad field never takes down a results page. */
function attempt(format: () => string | null): string | null {
  try { return format(); } catch { return null; }
}

/**
 * How far to move a box spanning `left`–`right` (px from the window's left edge) so it stays at least `margin`
 * inside a window `viewport` px wide. A box wider than the window keeps its start visible.
 */
export function shiftIntoView(left: number, right: number, viewport: number, margin = TIP_MARGIN): number {
  if (left < margin) return margin - left;
  if (right > viewport - margin) return Math.max(viewport - margin - right, margin - left);
  return 0;
}

/**
 * Keeps a date's tooltip (the date element's last child) at least TIP_MARGIN inside the window. It is measured with
 * its shown geometry (`data-measure`, set and removed within this call, so nothing is ever drawn with it): when the
 * pointer enters, :hover may not apply yet, and the hidden tooltip is a 1px box that says nothing about its width.
 */
function placeTip(date: HTMLElement) {
  const tip = date.lastElementChild as HTMLElement | null;
  if (!tip) return;
  tip.style.setProperty('--tip-shift', '0px');
  tip.setAttribute('data-measure', '');
  const { left, right } = tip.getBoundingClientRect();
  tip.removeAttribute('data-measure');
  const viewport = document.documentElement.clientWidth || window.innerWidth; // clientWidth: without a scrollbar
  tip.style.setProperty('--tip-shift', `${shiftIntoView(left, right, viewport)}px`);
}

/**
 * A mouse or pen over a date shows its price (`data-hover`); a finger does not. On a touch screen a tap opens the
 * operator's page and must leave nothing shown, and :hover (and @media (hover: hover), true on touchscreen laptops)
 * cannot tell a finger from a mouse, so the pointer's own type decides.
 */
function showTip(event: PointerEvent<HTMLElement>) {
  if (event.pointerType === 'touch') return;
  event.currentTarget.setAttribute('data-hover', '');
  placeTip(event.currentTarget);
}
function hideTip(event: PointerEvent<HTMLElement>) {
  event.currentTarget.removeAttribute('data-hover');
}

/** The star (the owner's drawing, RowsB13): an outline, filled once the tour is saved (CSS: --saved-star). */
const STAR = 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.8Z';

/**
 * 收藏 / 已收藏 (Save / Saved): a toggle that keeps the tour in this browser's list (lib/saved-tours), with `tour` as
 * its label there, or takes it out. A star and a word, never the star alone. Its accessible name is the same in both
 * states and says which tour (收藏「東瀛遊：大阪、京都，5日4夜」); aria-pressed carries the state. It never navigates and
 * is drawn above the stretched row link, so a press on it never opens the operator's page. The server renders it
 * unpressed (it cannot know); after hydration it shows what this browser holds.
 * Where the browser keeps nothing at all (site data blocked) it is not shown: the saved page says why. Where a change
 * cannot be written (storage full), the press changes nothing and the button says so in the same box (空間已滿, no
 * star), with a status line for screen readers saying why; the next press tries again.
 */
function SaveButton({ tourKey, tour, t }: { tourKey: string; tour: string; t: T }) {
  const saved = useSyncExternalStore(subscribeSaved, getSavedTours, getNoSavedTours);
  const [failed, setFailed] = useState(false);
  if (saved?.available === false) return null;
  const pressed = saved?.tours.some(s => s.key === tourKey) ?? false;
  const press = () => setFailed(!(pressed ? unsaveTour(tourKey) : saveTour(tourKey, { label: tour })));
  return (
    <>
      <button
        type="button"
        className={styles.save}
        aria-pressed={pressed}
        aria-label={t('save.name', { tour })}
        title={failed ? t('save.failedLong') : undefined}
        data-failed={failed ? '' : undefined}
        onClick={press}
      >
        {!failed && <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.star}><path d={STAR} /></svg>}
        {t(failed ? 'save.failed' : pressed ? 'save.saved' : 'save.save')}
      </button>
      {/* Out of the layout (absolute): announces a failed change, takes no column of the pair. */}
      <span aria-live="polite" className={styles.visuallyHidden}>{failed ? t('save.failedLong') : ''}</span>
    </>
  );
}

/**
 * One tour as a row of the list (the owner's final row, mock-up RowsB13). On a wide screen every Chinese row
 * has the same seven columns, so each starts at the same x down the page: the operator's tag | the days | the region (the country,
 * then its regions; or the countries) | the route, after a thin line, every stop, wrapping and never cut | the dates,
 * three by two | the lowest price with its change | the gold button to the operator's site over 加入行程 and 收藏, two
 * equal buttons side by side (each as wide as the column allows, 加入行程 never narrower than its words). No tour code
 * and no tour name. On an English page's wide screen (the owner's drawing E1) the same, in six columns: the region
 * sits above the route, smaller and muted, and each 'place →' is one unit. On a phone the row becomes a stacked block
 * in the same order of importance; from 640px a two-column block.
 *
 * The list is an ARIA table (Results): each row is a `row`, each column a `cell`, and the column names are in a
 * visually hidden header row.
 *
 * The gold button is the row's link to the operator's page, opened in a new tab; it stretches over the whole row
 * (CSS), so a press anywhere on the row opens the page. Each departure date is a link to the same page of its own,
 * which shows that date's price above it for a mouse and on keyboard focus (never for a finger); the dates are one
 * tab stop, moved through with the arrow keys. With an address that is not https there is no link: no gold button,
 * and the dates are plain text (price for a mouse only, no tab stop). The operator colour comes from
 * `operator.color` through `--c`; the tag's text is light or dark, whichever reads better on it. The link's name is
 * short; the start/end note, the price change, the old-data warning and the opened mark are its description.
 *
 * Opening the operator's page from the row (a click, a middle click or Enter on any of its links; not 加入行程 or 收藏)
 * records the tour for this tab (lib/opened-tours). A row opened before is tinted light ink, the one opened most
 * recently pale gold (the only gold row); both turn their date chips to the surface colour and offer 再看一次 ↗ in an
 * outlined button. No tag is drawn: screen readers get the mark as the link's description. The click is only
 * observed, never prevented or delayed. The marks are read in the browser after hydration (the server renders none);
 * they change no row's height.
 */
export function TourCard({ tour, operator, places, today, t, now, onAdd, footNote }: TourCardProps) {
  const [picking, setPicking] = useState(false);
  const [activeDate, setActiveDate] = useState(0);
  const addRef = useRef<HTMLButtonElement>(null);
  const dateRefs = useRef<(HTMLElement | null)[]>([]);
  const id = useId();
  const noteId = `${id}-note`;
  const changeId = `${id}-change`;
  const staleId = `${id}-stale`;
  const openedId = `${id}-opened`;
  const opened = useSyncExternalStore(subscribeOpened, getOpenedTours, getNoOpenedTours);
  const openedState = opened.at(-1) === tour.key ? 'latest' : opened.includes(tour.key) ? 'earlier' : undefined;

  const route = routeNames(tour.stops, places, t.locale);
  const operatorText = operatorName(operator, t.locale);
  const region = regionParts(tour.stops, places, t);
  const days = formatLength(tour.days, null, t);
  const length = formatLength(tour.days, tour.nights, t);
  const price = formatPrice(tour.windowPriceHkd);
  // Only a change is noted (priceChangeText gives nothing for an unchanged price).
  const change = tour.windowPriceHkd === tour.fromPriceHkd ? priceChangeText(tour.priceChange, today, t) : null;
  const note = startNote(tour.start, tour.end, t);
  const staleDay = now === undefined ? null : attempt(() => staleSince(tour.lastUpdated, now, t));
  const staleText = staleDay && t('row.stale', { date: staleDay });
  // Only dates after today are offered: the page's today, or the browser's once Hong Kong has passed midnight since
  // the page was made (a stored copy; lib/browser-today). The server and hydration use the page's, as stored.
  const upcomingAfter = useUpcomingAfter(today);
  const departures = tour.departures.filter(d => isIsoDate(d.date) && !(isIsoDate(upcomingAfter) && d.date <= upcomingAfter));
  const shown = departures.length <= DATE_CELLS ? departures : departures.slice(0, DATE_CELLS - 1);
  const moreDates = departures.length - shown.length;
  const linkable = LINKABLE_URL.test(tour.url);
  const safeColor = SAFE_COLOR.test(operator.color);
  const color = safeColor ? operator.color : FALLBACK_COLOR;
  const tagDark = safeColor && operatorTextTone(operator.color) === 'dark';
  const describedBy = [note && noteId, change && changeId, staleText && staleId, openedState && openedId].filter(Boolean).join(' ');
  const active = Math.min(activeDate, Math.max(shown.length - 1, 0));

  // After a press outside, focus stays where the visitor pressed; every other close returns it to the button.
  const closePicker = (reason?: PickerCloseReason) => {
    setPicking(false);
    if (reason !== 'outside') addRef.current?.focus({ preventScroll: true });
  };
  const pick = (date: IsoDate) => {
    closePicker();
    onAdd?.(date);
  };

  // The dates are one tab stop: the arrow keys, Home and End move between them (roving tabindex).
  const moveDate = (e: KeyboardEvent) => {
    const last = shown.length - 1;
    const next = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const to = Math.min(Math.max(next, 0), last);
    setActiveDate(to);
    dateRefs.current[to]?.focus();
  };

  const linkProps = { href: tour.url, target: '_blank', rel: 'noopener noreferrer' };

  // Any link in the row opens the operator's page: a primary click (also Enter, which clicks) or a middle click.
  const noteOpened = (e: MouseEvent) => {
    if (e.button > 1 || !(e.target instanceof Element) || !e.target.closest('a[href]')) return;
    recordOpened(tour.key);
  };

  return (
    <div
      role="row"
      className={styles.row}
      style={{ '--c': color } as CSSProperties}
      data-opened={openedState}
      onClick={noteOpened}
      onAuxClick={noteOpened}
    >
      <div role="cell" className={styles.tagCell}>
        <span className={tagDark ? `${styles.op} ${styles.opDark}` : styles.op}>{operatorText}</span>
        {/* Its operator's data is old: shown here in the block layouts (one of the two is shown; see the CSS). */}
        {staleText && <span className={`${styles.stale} ${styles.staleInTag}`}>{staleText}</span>}
      </div>

      <div role="cell" className={styles.days}>{days}</div>

      <div role="cell" className={styles.region}>
        {/*
          Each name is one unit, its dot glued to it (a no-break space), so lines break between names; a name made of
          several words may wrap between its own words when it alone is wider than the column (English), never inside
          a word, and a Chinese name never. The count of the rest goes inside the last unit, with no dot: '南極洲 +3'.
        */}
        {region.names.map((name, i) => (
          <Fragment key={i}>
            {i > 0 && ' '}
            <span className={styles.place}>
              {name}
              {i < region.names.length - 1 ? '\u00a0·' : region.more > 0 ? `\u00a0${t('card.moreRegions', { n: region.more })}` : ''}
            </span>
          </Fragment>
        ))}
        {note && <span id={noteId} className={styles.note}>{note}</span>}
        {footNote !== undefined && <span className={styles.footNote}>{footNote}</span>}
      </div>

      <div role="cell" className={styles.routeCell}>
        {/*
          Each stop's name is one unit, and the arrows sit between them with a space on each side, so a line breaks
          only beside an arrow (after it; or before it, when the name fits the line but its arrow does not). Only a
          single name wider than the whole column breaks inside itself, between its words.
          English pages wrap each arrow's glyph in its own element: in the wide row (the drawing E1) it is hidden, its
          spaces stay (as one), and the arrow is drawn at the end of the unit before it instead, after a no-break space
          (CSS), so each 'place →' is one unit and a line breaks only after an arrow. The block layouts are as above.
        */}
        <h3 className={styles.route}>
          {route.map((name, i) => t.locale === 'en' ? (
            <Fragment key={i}>
              {i > 0 && <span className={styles.arrow}>{' '}<span className={styles.arrowBetween}>→</span>{' '}</span>}
              <span className={styles.stop}>{name}</span>
            </Fragment>
          ) : (
            <Fragment key={i}>
              {i > 0 && <span className={styles.arrow}>{' → '}</span>}
              <span className={styles.stop}>{name}</span>
            </Fragment>
          ))}
        </h3>
        {openedState && (
          <span id={openedId} className={styles.visuallyHidden}>
            {t(openedState === 'latest' ? 'card.openedLatest' : 'card.openedEarlier')}
          </span>
        )}
      </div>

      <div role="cell" className={styles.datesCell}>
        {/* Every date has passed since the page was made: said plainly, not an empty cell (the next copy drops the row). */}
        {shown.length === 0 && tour.departures.length > 0 && <p className={styles.passed}>{t('card.datesPassed')}</p>}
        {shown.length > 0 && (
          <div role="group" aria-label={t('card.dates')} className={styles.dates} onKeyDown={moveDate}>
            {shown.map((d, i) => {
              const { hkd, from } = departurePrice(d, tour.fallbackPriceHkd);
              const { day, weekday } = chipDay(d.date, t);
              const priceText = from ? t('card.priceFrom', { price: formatPrice(hkd) }) : formatPrice(hkd);
              const content = (
                <>
                  <span className={styles.chip}>{day} <span className={styles.weekday}>{weekday}</span></span>
                  {/* The space separates date and price in the text that is read; it is not drawn. */}
                  {' '}
                  <span className={styles.tip}>
                    {from ? <PriceWithFrom price={formatPrice(hkd)} t={t} fromClassName={styles.tipFrom} /> : formatPrice(hkd)}
                  </span>
                </>
              );
              // Named by the full date (with its year, which the chip leaves out) and that date's price.
              const name = `${departureDateText(d.date, t) ?? day} ${priceText}`;
              const pointer = { className: styles.d, onPointerEnter: showTip, onPointerLeave: hideTip };
              return linkable ? (
                <a
                  key={d.date}
                  {...linkProps}
                  {...pointer}
                  aria-label={name}
                  ref={el => { dateRefs.current[i] = el; }}
                  tabIndex={i === active ? 0 : -1}
                  onFocus={e => { setActiveDate(i); placeTip(e.currentTarget); }}
                >
                  {content}
                </a>
              ) : (
                // Not a link: nothing to open, so not a tab stop either.
                <span key={d.date} {...pointer}>{content}</span>
              );
            })}
            {moreDates > 0 && (
              <span className={styles.more}>
                <span aria-hidden="true">{t('card.moreDatesCell', { n: moreDates })}</span>
                <span className={styles.visuallyHidden}>{t('card.moreDates', { n: moreDates })}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <div role="cell" className={styles.priceCell}>
        <div className={styles.price}><PriceWithFrom price={price} t={t} fromClassName={styles.from} /></div>
        {change && <div id={changeId} className={`${styles.delta} ${styles[change.tone]}`}>{change.text}</div>}
        {/* … and here, under the price and its note, in the seven columns. The link's description points here. */}
        {staleText && <span id={staleId} className={`${styles.stale} ${styles.staleInPrice}`}>{staleText}</span>}
      </div>

      <div role="cell" className={styles.actions}>
        {linkable && (
          <a
            className={styles.go}
            {...linkProps}
            aria-label={t('card.linkLabel', { operator: operatorText, route: route.join(t('dest.listSeparator')), length, price })}
            aria-describedby={describedBy || undefined}
          >
            {t(openedState ? 'row.again' : 'row.goTo')}
          </a>
        )}
        {/* 加入行程 and 收藏, side by side; the picker opens under them, at the column's right edge. */}
        <div className={styles.pair} data-open={picking ? '' : undefined}>
          {onAdd && (
            <div>
              <button
                ref={addRef}
                type="button"
                className={styles.add}
                aria-expanded={picking}
                aria-haspopup="dialog"
                onClick={() => (picking ? closePicker() : setPicking(true))}
              >
                {t('card.add')}
              </button>
              {picking && (
                <DeparturePicker
                  departures={departures}
                  fallbackPriceHkd={tour.fallbackPriceHkd}
                  today={upcomingAfter}
                  t={t}
                  openerRef={addRef}
                  onPick={pick}
                  onClose={closePicker}
                />
              )}
            </div>
          )}
          <SaveButton
            tourKey={tour.key}
            tour={t('save.tour', { operator: operatorText, route: route.join(t('dest.listSeparator')), length })}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}
