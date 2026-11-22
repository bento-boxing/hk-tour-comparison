import { SiteLink } from './SiteLink';
import type { ReactNode } from 'react';
import type { IsoDate, OperatorId, PlacesIndex } from '@hktours/core';
import type { OperatorInfo } from '@hktours/db/read';
import type { TourRow } from '../lib/tour-row';
import type { T } from '../lib/i18n';
import { localeHref } from '../lib/locale-path';
import { TourCard } from './TourCard';
import styles from './Results.module.css';

export interface ResultsProps {
  tours: TourRow[];
  /** Every match before paging. */
  total: number;
  operators: OperatorInfo[]; places: PlacesIndex; today: IsoDate; t: T;
  /** The server's time of this render (ISO): rows whose operator's data is older than 36 hours are marked. */
  now?: string;
  /** When given, every row has the 加入行程 button and calls this with the chosen date. */
  onAdd?: (tour: TourRow, departure: IsoDate) => void;
  /** The lower of each card's two buttons on a phone: 收藏 ('save', the default) or ＋ 加入 ('add', with onAdd). */
  phoneAction?: 'save' | 'add';
  /** When given, each row's note (shown under its price), e.g. '休息 1–2 日後出發'. */
  footNote?: (tour: TourRow) => string | undefined;
  /** When given, shown instead of the default empty message and its clear-all link (only when total is 0). */
  empty?: ReactNode;
  /**
   * Where the clear-all link goes, without a language: the search page ('/', the default), or on a destination's
   * page that destination's page ('/tours/japan'), so clearing the filters keeps the destination.
   */
  clearPath?: string;
}

/** An operator missing from the operators list still gets a row: its id as the name, and the fallback grey (--op-fallback). */
const unknownOperator = (id: OperatorId): OperatorInfo => ({ id, nameZh: id, nameEn: id, color: '', lastGoodRunAt: null });

/** The list's columns, in the rows' order: their names, read by screen readers only. */
const COLUMNS = ['col.operator', 'col.days', 'col.region', 'col.route', 'col.dates', 'col.price', 'col.actions'] as const;

/**
 * The tours as rows in one bordered list (mock-up RowsB13); with no match at all, the empty message with a link
 * that clears every filter. A page past the last (matches, but none on this page) gets a neutral line instead: the
 * pager below it links back to page 1. The count of matches is under the list (ListFooter).
 * The list is an ARIA table (role="table", "row", "cell"): the columns have no visible headings, so their names are in
 * a header row that only screen readers read. ARIA roles rather than <table>, because on a phone a row is a card
 * and a real table's semantics are lost in some browsers once its display is changed.
 */
export function Results({ tours, total, operators, places, today, t, now, onAdd, phoneAction, footNote, empty, clearPath = '/' }: ResultsProps) {
  const byId = new Map(operators.map(o => [o.id, o]));
  return (
    <>
      {/* Announced when a filter change brings the empty message (the count under the list is announced too). */}
      <div aria-live="polite">
        {tours.length === 0 && total > 0 ? (
          <p className={styles.beyond}>{t('pager.beyond')}</p>
        ) : tours.length === 0 && (
          <div className={styles.empty}>
            {empty ?? (
              <>
                <p className={styles.emptyText}>{t('search.empty')}</p>
                <SiteLink href={localeHref(t.locale, clearPath)} className={styles.clearAll}>{t('search.clearAll')}</SiteLink>
              </>
            )}
          </div>
        )}
      </div>
      {tours.length > 0 && (
        <div role="table" aria-label={t('search.listLabel')} className={styles.list}>
          <div role="row" className={styles.visuallyHidden}>
            {COLUMNS.map(key => <span key={key} role="columnheader">{t(key)}</span>)}
          </div>
          {tours.map(tour => (
            <TourCard
              key={tour.key}
              tour={tour}
              operator={byId.get(tour.operatorId) ?? unknownOperator(tour.operatorId)}
              places={places}
              today={today}
              now={now}
              t={t}
              onAdd={onAdd && (departure => onAdd(tour, departure))}
              phoneAction={phoneAction}
              footNote={footNote?.(tour)}
            />
          ))}
        </div>
      )}
    </>
  );
}
