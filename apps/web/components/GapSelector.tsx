'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { MAX_GAP_DAYS } from '@hktours/core';
import type { T } from '../lib/i18n';
import styles from './GapSelector.module.css';

type Gap = { min: number; max: number };

export interface GapSelectorProps {
  gap: Gap;
  /** Called with the whole new gap, always min ≤ max. */
  onChange: (gap: Gap) => void;
  t: T;
}

const DAYS = Array.from({ length: MAX_GAP_DAYS + 1 }, (_, i) => i);

/** How long keyboard stepping must pause before the shown gap is applied. */
export const KEYBOARD_SETTLE_MS = 400;

/** Keys that move focus or close things rather than change a select's value. */
const NON_CHANGING_KEYS = new Set(['Tab', 'Shift', 'Escape', 'Control', 'Alt', 'Meta']);

/**
 * The rest before the next leg as `[1] – [3] 日`: two native selects, 0 to MAX_GAP_DAYS, labelled 最少 and 最多
 * and grouped under 休息. A minimum above the maximum raises the maximum to match, and the reverse.
 *
 * A pick with the pointer applies at once. On a closed native select each arrow key fires change, so a
 * change made from the keyboard is shown at once but applied only after KEYBOARD_SETTLE_MS without another
 * one (or when focus leaves the select): stepping through several values navigates once, with the last.
 */
export function GapSelector({ gap, onChange, t }: GapSelectorProps) {
  // The values on screen: the address's gap, or a keyboard change not yet applied.
  const [shown, setShown] = useState(gap);
  const [fromAddress, setFromAddress] = useState(gap);
  if (fromAddress.min !== gap.min || fromAddress.max !== gap.max) {
    setFromAddress(gap); // a new address replaces anything pending
    setShown(gap);
  }

  const viaKeyboard = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Gap | null>(null);

  const cancelPending = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  };
  useEffect(() => cancelPending, []); // a pending change is dropped when the selector goes away

  const apply = (next: Gap) => {
    cancelPending();
    onChange(next);
  };
  const flush = () => { if (pending.current) apply(pending.current); };

  const change = (next: Gap) => {
    setShown(next);
    if (!viaKeyboard.current) { apply(next); return; }
    cancelPending();
    pending.current = next;
    timer.current = setTimeout(() => apply(next), KEYBOARD_SETTLE_MS);
  };
  const setMin = (min: number) => change({ min, max: Math.max(shown.max, min) });
  const setMax = (max: number) => change({ min: Math.min(shown.min, max), max });

  const inputEvents = {
    onKeyDown: (e: KeyboardEvent) => { if (!NON_CHANGING_KEYS.has(e.key)) viaKeyboard.current = true; },
    onPointerDown: () => { viaKeyboard.current = false; },
    onBlur: flush,
  };

  return (
    <span role="group" aria-label={t('chain.rest')} className={styles.gap}>
      <label className={styles.field}>
        <span className={styles.label}>{t('chain.gapMin')}</span>
        <select className={styles.select} value={shown.min} onChange={e => setMin(Number(e.target.value))} {...inputEvents}>
          {DAYS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <span aria-hidden="true">–</span>
      <label className={styles.field}>
        <span className={styles.label}>{t('chain.gapMax')}</span>
        <select className={styles.select} value={shown.max} onChange={e => setMax(Number(e.target.value))} {...inputEvents}>
          {DAYS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <span>{t('chain.days')}</span>
    </span>
  );
}
