'use client';

import { Fragment, useId, useRef, useState, type CSSProperties } from 'react';
import { isIsoDate, type IsoDate, type PlacesIndex } from '@hktours/core';
import type { OperatorInfo, TourCardData } from '@hktours/db';
import type { T } from '../lib/i18n';
import { formatChipDate, formatLength, formatPrice, formatUpdated } from '../lib/format';
import { priceChangeText, regionLabel, routeNames, startNote } from '../lib/card-text';
import { DeparturePicker, type PickerCloseReason } from './DeparturePicker';
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
const FALLBACK_COLOR = 'var(--charcoal)';

/** Runs a formatter that may throw on bad data; null instead, so one bad field never takes down a results page. */
function attempt(format: () => string | null): string | null {
  try { return format(); } catch { return null; }
}

/**
 * One tour (mockup `.card`). Everything but the add button is one link to the operator's page, opened in
 * a new tab, or a plain block when the address is not https. The operator colour comes from
 * `operator.color` through the `--c` custom property. The link's name is short; the start/end note,
 * the price change and the dates are attached to it as its description.
 */
export function TourCard({ tour, operator, places, today, t, onAdd, footNote }: TourCardProps) {
  const [picking, setPicking] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const noteId = `${id}-note`;
  const changeId = `${id}-change`;
  const datesId = `${id}-dates`;

  const route = routeNames(tour.stops, places);
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
  const color = SAFE_COLOR.test(operator.color) ? operator.color : FALLBACK_COLOR;
  const describedBy = [note && noteId, change && changeId, chips.length > 0 && datesId].filter(Boolean).join(' ');

  // After a press outside, focus stays where the visitor pressed; every other close returns it to the button.
  const closePicker = (reason?: PickerCloseReason) => {
    setPicking(false);
    if (reason !== 'outside') addRef.current?.focus({ preventScroll: true });
  };
  const pick = (date: IsoDate) => {
    closePicker();
    onAdd?.(date);
  };

  const body = (
    <>
      <div className={styles.top}>
        <span className={styles.op}>{operator.nameZh}</span>
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
          <div className={styles.price}>{price}{' '}<small className={styles.from}>{t('card.from')}</small></div>
          {change && <div id={changeId} className={`${styles.delta} ${styles[change.tone]}`}>{change.text}</div>}
        </div>
      </div>
      {chips.length > 0 && (
        <div id={datesId} className={styles.dates}>
          {chips.map(d => <span key={d.date} className={styles.d}>{formatChipDate(d.date, today)}</span>)}
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
        {linkable && <span className={styles.go}>{t('card.goTo', { operator: operator.nameZh })}</span>}
      </div>
    </>
  );

  return (
    <article className={styles.card} style={{ '--c': color } as CSSProperties}>
      {linkable ? (
        <a
          className={`${styles.body} ${styles.link}`}
          href={tour.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('card.linkLabel', { operator: operator.nameZh, route: route.join(t('dest.listSeparator')), length, price })}
          aria-describedby={describedBy || undefined}
        >
          {body}
        </a>
      ) : (
        <div className={styles.body}>{body}</div>
      )}
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
