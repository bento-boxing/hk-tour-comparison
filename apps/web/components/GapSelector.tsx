'use client';

import { MAX_GAP_DAYS } from '@hktours/core';
import type { T } from '../lib/i18n';
import styles from './GapSelector.module.css';

export interface GapSelectorProps {
  gap: { min: number; max: number };
  /** Called with the whole new gap, always min ≤ max. */
  onChange: (gap: { min: number; max: number }) => void;
  t: T;
}

const DAYS = Array.from({ length: MAX_GAP_DAYS + 1 }, (_, i) => i);

/**
 * The rest before the next leg as `[1] – [3] 日`: two native selects, 0 to MAX_GAP_DAYS, labelled 最少 and 最多
 * and grouped under 休息. A minimum above the maximum raises the maximum to match, and the reverse.
 */
export function GapSelector({ gap, onChange, t }: GapSelectorProps) {
  const setMin = (min: number) => onChange({ min, max: Math.max(gap.max, min) });
  const setMax = (max: number) => onChange({ min: Math.min(gap.min, max), max });
  return (
    <span role="group" aria-label={t('chain.rest')} className={styles.gap}>
      <label className={styles.field}>
        <span className={styles.label}>{t('chain.gapMin')}</span>
        <select className={styles.select} value={gap.min} onChange={e => setMin(Number(e.target.value))}>
          {DAYS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <span aria-hidden="true">–</span>
      <label className={styles.field}>
        <span className={styles.label}>{t('chain.gapMax')}</span>
        <select className={styles.select} value={gap.max} onChange={e => setMax(Number(e.target.value))}>
          {DAYS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <span>{t('chain.days')}</span>
    </span>
  );
}
