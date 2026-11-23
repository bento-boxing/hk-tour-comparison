'use client';

import { useEffect, useId, useRef, type RefObject } from 'react';
import { isIsoDate, type IsoDate, type ScrapedDeparture } from '@hktours/core';
import type { T } from '../lib/i18n';
import { usePopoverDismiss } from '../lib/use-popover-dismiss';
import { formatPrice } from '../lib/format';
import { PHONE_MEDIA } from '../lib/breakpoints';
import { departureDateText } from '../lib/card-text';
import { PriceWithFrom } from './PriceWithFrom';
import styles from './DeparturePicker.module.css';

/** How the picker was closed, so the opener can decide where focus goes ('outside': leave it where the visitor pressed). */
export type PickerCloseReason = 'escape' | 'closeButton' | 'outside';

export interface DeparturePickerProps {
  departures: ScrapedDeparture[]; fallbackPriceHkd: number; today: IsoDate; t: T;
  /** The button that opened it: a press there is not outside (its own click closes the picker). */
  openerRef?: RefObject<HTMLElement | null>;
  /** Each date is a button that calls this (加入行程). Without it the dates are only listed: links with `link`, else text. */
  onPick?: (date: IsoDate) => void;
  onClose: (reason: PickerCloseReason) => void;
  /** The heading; picker.title (選擇出發日期) when not given. */
  title?: string;
  /** Without onPick: each date links to the operator's page with these attributes (as the card's own dates do). */
  link?: { href: string; target: string; rel: string };
  /** 'end' (the default): it opens under its opener's right edge, leftwards; 'start': under its left edge, rightwards. */
  placement?: 'start' | 'end';
}

/**
 * The date list opened from a card's 加入行程 button: a non-modal dialog with one button per departure
 * after today. Focus starts on the first date; Escape inside it, the close button or a press outside call onClose.
 * The opener is responsible for positioning it and for returning focus when it closes.
 * The same list, without onPick, is a phone card's list of all its dates (its +N): each a link to the operator's page.
 */
export function DeparturePicker({
  departures, fallbackPriceHkd, today, t, openerRef, onPick, onClose, title, link, placement = 'end',
}: DeparturePickerProps) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // On a phone a list opened near the window's foot is scrolled into view whole first (the bottom bar, which would
    // cover it, slides away while any list is open: data-departure-picker, components/TabBar.module.css). Not from
    // 1024px, where nothing changes.
    if (window.matchMedia?.(PHONE_MEDIA).matches) rootRef.current?.scrollIntoView?.({ block: 'nearest' });
    (firstRef.current ?? closeRef.current)?.focus();
  }, []);

  // A press outside (not on the opener) → 'outside'; Escape inside the dialog → 'escape'.
  const onKeyDown = usePopoverDismiss(rootRef, onClose, openerRef);

  // Only dates after today are upcoming (a tour leaving today has left). With an unusable `today` nothing is hidden.
  const upcoming = isIsoDate(today) ? departures.filter(d => d.date > today) : departures;

  return (
    <div
      ref={rootRef} role="dialog" aria-labelledby={titleId} onKeyDown={onKeyDown} data-departure-picker=""
      className={placement === 'start' ? `${styles.picker} ${styles.start}` : styles.picker}
    >
      <div className={styles.head}>
        <span id={titleId} className={styles.title}>{title ?? t('picker.title')}</span>
        <button ref={closeRef} type="button" className={styles.close} aria-label={t('picker.close')} onClick={() => onClose('closeButton')}>✕</button>
      </div>
      {/* None left (every date passed since the page was made, lib/browser-today): said, not an empty list. */}
      {upcoming.length === 0 && <p className={styles.none}>{t('card.datesPassed')}</p>}
      {upcoming.length > 0 && <ul className={styles.list}>
        {upcoming.map((d, i) => {
          const content = (
            <>
              <span>{departureDateText(d.date, t) ?? d.date}</span>
              {' '}
              <span className={styles.price}>
                {d.priceHkd === null
                  ? <PriceWithFrom price={formatPrice(fallbackPriceHkd)} t={t} fromClassName={styles.from} />
                  : formatPrice(d.priceHkd)}
              </span>
            </>
          );
          const ref = i === 0 ? firstRef : undefined;
          return (
            <li key={d.date}>
              {onPick ? (
                <button ref={ref} type="button" className={styles.date} onClick={() => onPick(d.date)}>{content}</button>
              ) : link ? (
                <a ref={ref} {...link} className={styles.date}>{content}</a>
              ) : (
                <span className={styles.date}>{content}</span>
              )}
            </li>
          );
        })}
      </ul>}
    </div>
  );
}
