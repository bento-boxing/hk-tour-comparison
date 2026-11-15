'use client';

import { Fragment, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type SyntheticEvent } from 'react';
import { isIsoDate, type IsoDate, type PlacesIndex } from '@hktours/core';
import type { OperatorInfo, TourCardData } from '@hktours/db';
import type { T } from '../lib/i18n';
import { operatorTextTone } from '../lib/contrast';
import { formatChipDate, formatLength, formatPrice, formatUpdated } from '../lib/format';
import { departurePrice, priceChangeText, regionLabel, routeNames, startNote } from '../lib/card-text';
import { operatorName } from '../lib/place-names';
import { DeparturePicker, type PickerCloseReason } from './DeparturePicker';
import { PriceWithFrom } from './PriceWithFrom';
import styles from './TourCard.module.css';

export interface TourCardProps {
  tour: TourCardData; operator: OperatorInfo; places: PlacesIndex; today: IsoDate; t: T;
  /** When given, the 加入行程 button is shown and calls this with the chosen date. */
  onAdd?: (departure: IsoDate) => void;
  footNote?: string;   // shown above the 'updated' text in the footer, e.g. '休息 1–2 日後出發'
}

export const MAX_DATE_CHIPS = 4;

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

/** Keeps a date's tooltip (the date element's last child) inside the window, measured as it appears. */
function placeTip(event: SyntheticEvent<HTMLElement>) {
  const tip = event.currentTarget.lastElementChild as HTMLElement | null;
  if (!tip) return;
  tip.style.setProperty('--tip-shift', '0px');
  const { left, right } = tip.getBoundingClientRect();
  const viewport = document.documentElement.clientWidth || window.innerWidth; // clientWidth: without a scrollbar
  tip.style.setProperty('--tip-shift', `${shiftIntoView(left, right, viewport)}px`);
}

/**
 * One tour (mockup `.card`). The card is one link to the operator's page, opened in a new tab: the link holds the
 * top of the card and stretches over the whole card (CSS), so a press anywhere on it opens the page. Each departure
 * date is a link to the same page of its own, which shows that date's price above it on hover and on keyboard
 * focus; the dates are one tab stop, moved through with the arrow keys. A plain block instead of links when the
 * address is not https. The operator colour comes from `operator.color` through the `--c` custom property; the
 * tag's text is light or dark, whichever reads better on it. The link's name is short; the start/end note and
 * the price change are attached to it as its description.
 */
export function TourCard({ tour, operator, places, today, t, onAdd, footNote }: TourCardProps) {
  const [picking, setPicking] = useState(false);
  const [activeDate, setActiveDate] = useState(0);
  const addRef = useRef<HTMLButtonElement>(null);
  const dateRefs = useRef<(HTMLElement | null)[]>([]);
  const id = useId();
  const noteId = `${id}-note`;
  const changeId = `${id}-change`;

  const route = routeNames(tour.stops, places, t.locale);
  const operatorText = operatorName(operator, t.locale);
  const region = regionLabel(tour.stops, places, t);
  const length = formatLength(tour.days, tour.nights, t);
  const price = formatPrice(tour.windowPriceHkd);
  const change = tour.windowPriceHkd === tour.fromPriceHkd ? priceChangeText(tour.priceChange, today, t) : null;
  const note = startNote(tour.start, tour.end, t);
  const updated = attempt(() => formatUpdated(tour.lastUpdated, today, t));
  const departures = tour.departures.filter(d => isIsoDate(d.date));
  const chips = departures.slice(0, MAX_DATE_CHIPS);
  const moreDates = departures.length - chips.length;
  const linkable = LINKABLE_URL.test(tour.url);
  const safeColor = SAFE_COLOR.test(operator.color);
  const color = safeColor ? operator.color : FALLBACK_COLOR;
  const tagDark = safeColor && operatorTextTone(operator.color) === 'dark';
  const describedBy = [note && noteId, change && changeId].filter(Boolean).join(' ');
  const active = Math.min(activeDate, Math.max(chips.length - 1, 0));

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
    const last = chips.length - 1;
    const next = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const to = Math.min(Math.max(next, 0), last);
    setActiveDate(to);
    dateRefs.current[to]?.focus();
  };

  const linkProps = { href: tour.url, target: '_blank', rel: 'noopener noreferrer' };

  const head = (
    <>
      <div className={styles.top}>
        <span className={tagDark ? `${styles.op} ${styles.opDark}` : styles.op}>{operatorText}</span>
        {region && <span className={styles.reg}>{region}</span>}
      </div>
      <h3 className={styles.route}>
        {route.map((name, i) => (
          <Fragment key={i}>
            {i > 0 && <span className={styles.arrow}>→</span>}
            {name}
          </Fragment>
        ))}
      </h3>
      {note && <span id={noteId} className={styles.note}>{note}</span>}
      <div className={styles.meta}>
        <div className={styles.days}>{length}</div>
        <div>
          <div className={styles.price}><PriceWithFrom price={price} t={t} fromClassName={styles.from} /></div>
          {change && <div id={changeId} className={`${styles.delta} ${styles[change.tone]}`}>{change.text}</div>}
        </div>
      </div>
    </>
  );

  return (
    <article className={styles.card} style={{ '--c': color } as CSSProperties}>
      {linkable ? (
        <a
          className={`${styles.body} ${styles.link}`}
          {...linkProps}
          aria-label={t('card.linkLabel', { operator: operatorText, route: route.join(t('dest.listSeparator')), length, price })}
          aria-describedby={describedBy || undefined}
        >
          {head}
        </a>
      ) : (
        <div className={styles.body}>{head}</div>
      )}
      {chips.length > 0 && (
        <div role="group" aria-label={t('card.dates')} className={styles.dates} onKeyDown={moveDate}>
          {chips.map((d, i) => {
            const { hkd, from } = departurePrice(d, tour.fallbackPriceHkd);
            const content = (
              <>
                <span>{formatChipDate(d.date, today, t)}</span>
                {/* The space separates date and price in the accessible name; at the end of the line, it is not drawn. */}
                {' '}
                <span className={styles.tip}>
                  {from ? <PriceWithFrom price={formatPrice(hkd)} t={t} fromClassName={styles.tipFrom} /> : formatPrice(hkd)}
                </span>
              </>
            );
            const dateProps = {
              ref: (el: HTMLElement | null) => { dateRefs.current[i] = el; },
              className: styles.d,
              tabIndex: i === active ? 0 : -1,
              onFocus: (e: SyntheticEvent<HTMLElement>) => { setActiveDate(i); placeTip(e); },
              onPointerEnter: placeTip,
            };
            return linkable
              ? <a key={d.date} {...linkProps} {...dateProps}>{content}</a>
              : <span key={d.date} {...dateProps}>{content}</span>;
          })}
          {moreDates > 0 && <span className={`${styles.d} ${styles.more}`}>{t('card.moreDates', { n: moreDates })}</span>}
        </div>
      )}
      <div className={styles.foot}>
        {footNote === undefined ? <span>{updated}</span> : (
          <span className={styles.footLeft}>
            <span>{footNote}</span>
            {updated && <span>{updated}</span>}
          </span>
        )}
        {linkable && <span className={styles.go}>{t('card.goTo', { operator: operatorText })}</span>}
      </div>
      {onAdd && (
        <div className={styles.addArea}>
          <button
            ref={addRef}
            type="button"
            className={styles.add}
            aria-expanded={picking}
            aria-haspopup="dialog"
            // While the picker is open, a press here must not count as "outside" (which would close it
            // only for this click to reopen it): the click below closes it instead.
            onPointerDown={e => { if (picking) e.stopPropagation(); }}
            onClick={() => (picking ? closePicker() : setPicking(true))}
          >
            {t('card.add')}
          </button>
          {picking && (
            <DeparturePicker
              departures={departures}
              fallbackPriceHkd={tour.fallbackPriceHkd}
              today={today}
              t={t}
              onPick={pick}
              onClose={closePicker}
            />
          )}
        </div>
      )}
    </article>
  );
}
