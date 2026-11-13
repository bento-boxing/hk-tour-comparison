'use client';

import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { isIsoDate, type IsoDate, type ScrapedDeparture } from '@hktours/core';
import type { T } from '../lib/i18n';
import { formatPrice } from '../lib/format';
import { departureDateText } from '../lib/card-text';
import styles from './DeparturePicker.module.css';

export interface DeparturePickerProps {
  departures: ScrapedDeparture[]; fallbackPriceHkd: number; today: IsoDate; t: T;
  onPick: (date: IsoDate) => void; onClose: () => void;
}

/**
 * The date list opened from a card's 加入行程 button: a non-modal dialog with one button per departure
 * from today on. Focus starts on the first date; Escape inside it, the close button or a press outside call onClose.
 * The opener is responsible for positioning it and for returning focus when it closes.
 */
export function DeparturePicker({ departures, fallbackPriceHkd, today, t, onPick, onClose }: DeparturePickerProps) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Read through a ref so the document listeners below are attached once, not on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    (firstRef.current ?? closeRef.current)?.focus();
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !rootRef.current?.contains(e.target)) onCloseRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); };
  }, []);

  // On the dialog, not the document, so Escape pressed in another widget stays with that widget.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !e.nativeEvent.isComposing) { e.preventDefault(); e.stopPropagation(); onClose(); }
  };

  // Past dates cannot be booked. With an unusable `today` nothing is hidden.
  const upcoming = isIsoDate(today) ? departures.filter(d => d.date >= today) : departures;

  return (
    <div ref={rootRef} role="dialog" aria-labelledby={titleId} className={styles.picker} onKeyDown={onKeyDown}>
      <div className={styles.head}>
        <span id={titleId} className={styles.title}>{t('picker.title')}</span>
        <button ref={closeRef} type="button" className={styles.close} aria-label={t('picker.close')} onClick={onClose}>✕</button>
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
