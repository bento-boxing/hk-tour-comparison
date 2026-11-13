'use client';

import { Fragment, type CSSProperties } from 'react';
import type { IsoDate, PlacesIndex } from '@hktours/core';
import type { OperatorInfo } from '@hktours/db/read';
import type { T } from '../lib/i18n';
import { chainTotals, type ResolvedLeg } from '../lib/chain';
import { routeNames } from '../lib/card-text';
import { formatChipDate, formatPrice } from '../lib/format';
import { GapSelector } from './GapSelector';
import styles from './ChainStrip.module.css';

export interface ChainStripProps {
  legs: ResolvedLeg[];
  operators: OperatorInfo[]; places: PlacesIndex; today: IsoDate; t: T;
  /** The rest wanted before the next leg. */
  gap: { min: number; max: number };
  /** Where the next leg can depart; null (a full chain) hides the gap selector and the placeholder. */
  departWindow: { from: IsoDate; to: IsoDate } | null;
  onGapChange: (gap: { min: number; max: number }) => void;
  onRemoveLast: () => void;
}

/** Only #rrggbb reaches the inline style (as on the tour card). */
const SAFE_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * The chosen legs (mockup Screen 2 `.chain`): each leg in its operator colour with its route, operator,
 * dates and price; `休息 n 日` between legs; after the last, the gap selector and the dashed placeholder
 * with the next window; on the right the running total and the remove-last button.
 */
export function ChainStrip({ legs, operators, places, today, t, gap, departWindow, onGapChange, onRemoveLast }: ChainStripProps) {
  const byId = new Map(operators.map(o => [o.id, o]));
  const totals = chainTotals(legs);
  const date = (d: IsoDate) => formatChipDate(d, today);
  const from = ` ${t('card.from')}`;

  return (
    <div className={styles.chain}>
      {legs.map((leg, i) => {
        const operator = byId.get(leg.tour.operatorId);
        const color = operator && SAFE_COLOR.test(operator.color) ? operator.color : 'var(--charcoal)';
        const facts = [
          operator?.nameZh ?? leg.tour.operatorId,
          `${date(leg.departure)} – ${date(leg.endDate)}`,
          `${formatPrice(leg.priceHkd)}${leg.priceIsExact ? '' : from}`,
        ].join(' · ');
        return (
          <Fragment key={`${leg.tour.key}@${leg.departure}`}>
            {leg.gapBefore !== null && (
              <div className={styles.gap}>
                <span>{t('chain.restDays', { n: leg.gapBefore })}</span>
                <div className={styles.line} aria-hidden="true" />
              </div>
            )}
            <div className={styles.leg} data-leg="" style={{ '--c': color } as CSSProperties}>
              <span className={styles.route}>{routeNames(leg.tour.stops, places).join(' → ')}</span>
              <small className={styles.facts}>{facts}</small>
            </div>
          </Fragment>
        );
      })}

      {departWindow && (
        <>
          <div className={styles.gap}>
            <span aria-hidden="true">{t('chain.rest')}</span>
            <div className={styles.line} aria-hidden="true" />
            <span className={styles.gapbox}><GapSelector gap={gap} onChange={onGapChange} t={t} /></span>
          </div>
          <div className={`${styles.leg} ${styles.next}`} data-next="">
            <span>
              {t('chain.pickNext')}
              <br />
              <span>{t('chain.window', { from: date(departWindow.from), to: date(departWindow.to) })}</span>
            </span>
          </div>
        </>
      )}

      <div className={styles.total}>
        {t('chain.total')}
        <b className={styles.totalPrice}>
          {formatPrice(totals.priceHkd)}
          {!totals.priceIsExact && <small className={styles.from}>{from}</small>}
        </b>
        {legs.length > 1
          ? t('chain.totalSpan', { days: totals.tourDays, span: totals.spanDays })
          : t('chain.totalDays', { days: totals.tourDays })}
        <button type="button" className={styles.remove} onClick={onRemoveLast}>{t('chain.removeLast')}</button>
      </div>
    </div>
  );
}
