'use client';

import { useEffect, useId, useRef } from 'react';
import { isIsoDate, type IsoDate, type ScrapedDeparture } from '@hktours/core';
import type { T } from '../lib/i18n';
import { usePopoverDismiss } from '../lib/use-popover-dismiss';
import { formatPrice } from '../lib/format';
import { departureDateText } from '../lib/card-text';
import styles from './DeparturePicker.module.css';

/** How the picker was closed, so the opener can decide where focus goes ('outside': leave it where the visitor pressed). */
export type PickerCloseReason = 'escape' | 'closeButton' | 'outside';

export interface DeparturePickerProps {
  departures: ScrapedDeparture[]; fallbackPriceHkd: number; today: IsoDate; t: T;
  onPick: (date: IsoDate) => void; onClose: (reason: PickerCloseReason) => void;
}

/**
 * The date list opened from a card's 加入行程 button: a non-modal dialog with one button per departure
 * after today. Focus starts on the first date; Escape inside it, the close button or a press outside call onClose.
 * The opener is responsible for positioning it and for returning focus when it closes.
 */
export function DeparturePicker({ departures, fallbackPriceHkd, today, t, onPick, onClose }: DeparturePickerProps) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (firstRef.current ?? closeRef.current)?.focus();
  }, []);

  // A press outside → 'outside'; Escape inside the dialog → 'escape'.
  const onKeyDown = usePopoverDismiss(rootRef, onClose);

  // Only dates after today are upcoming (a tour leaving today has left). With an unusable `today` nothing is hidden.
  const upcoming = isIsoDate(today) ? departures.filter(d => d.date > today) : departures;

  return (
    <div ref={rootRef} role="dialog" aria-labelledby={titleId} className={styles.picker} onKeyDown={onKeyDown}>
      <div className={styles.head}>
        <span id={titleId} className={styles.title}>{t('picker.title')}</span>
        <button ref={closeRef} type="button" className={styles.close} aria-label={t('picker.close')} onClick={() => onClose('closeButton')}>✕</button>
      </div>
      <ul className={styles.list}>
        {upcoming.map((d, i) => (
          <li key={d.date}>
            <button ref={i === 0 ? firstRef : undefined} type="button" className={styles.date} onClick={() => onPick(d.date)}>
              <span>{departureDateText(d.date, t) ?? d.date}</span>
              {' '}
              <span className={styles.price}>
                {formatPrice(d.priceHkd ?? fallbackPriceHkd)}
                {d.priceHkd === null && <>{' '}<small className={styles.from}>{t('card.from')}</small></>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
