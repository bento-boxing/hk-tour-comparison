import Link from 'next/link';
import type { ReactNode } from 'react';
import type { IsoDate, OperatorId, PlacesIndex } from '@hktours/core';
import type { OperatorInfo, TourCardData } from '@hktours/db/read';
import type { T } from '../lib/i18n';
import { TourCard } from './TourCard';
import styles from './Results.module.css';

export interface ResultsProps {
  tours: TourCardData[];
  /** Every match before paging. */
  total: number;
  operators: OperatorInfo[]; places: PlacesIndex; today: IsoDate; t: T;
  /** When given, every card has the 加入行程 button and calls this with the chosen date. */
  onAdd?: (tour: TourCardData, departure: IsoDate) => void;
  /** When given, each card's footer note (in place of its 'updated' text), e.g. '休息 1–2 日後出發'. */
  footNote?: (tour: TourCardData) => string | undefined;
  /** When given, shown instead of the default empty message and its clear-all link (only when total is 0). */
  empty?: ReactNode;
}

/** An operator missing from the operators list still gets a card: its id as the name, and the charcoal fallback colour. */
const unknownOperator = (id: OperatorId): OperatorInfo => ({ id, nameZh: id, nameEn: id, color: '', lastGoodRunAt: null });

/**
 * The count line and the cards (mockup `.grid`); with no match at all, the empty message with a link that
 * clears every filter. A page past the last (matches, but none on this page) gets a neutral line instead:
 * the Pager below it links back to page 1.
 */
export function Results({ tours, total, operators, places, today, t, onAdd, footNote, empty }: ResultsProps) {
  const byId = new Map(operators.map(o => [o.id, o]));
  return (
    <>
      {/* Announced when a filter change brings a new count or the empty message. */}
      <div aria-live="polite">
        {tours.length === 0 && total > 0 ? (
          <p className={styles.count}>{t('pager.beyond')}</p>
        ) : tours.length === 0 ? (
          <div className={styles.empty}>
            {empty ?? (
              <>
                <p className={styles.emptyText}>{t('search.empty')}</p>
                <Link href="/" className={styles.clearAll}>{t('search.clearAll')}</Link>
              </>
            )}
          </div>
        ) : (
          <p className={styles.count}>{t('search.count', { n: total })}</p>
        )}
      </div>
      {tours.length > 0 && (
        <div className={styles.grid}>
          {tours.map(tour => (
            <TourCard
              key={tour.key}
              tour={tour}
              operator={byId.get(tour.operatorId) ?? unknownOperator(tour.operatorId)}
              places={places}
              today={today}
              t={t}
              onAdd={onAdd && (departure => onAdd(tour, departure))}
              footNote={footNote?.(tour)}
            />
          ))}
        </div>
      )}
    </>
  );
}
