'use client';

import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { MAX_GAP_DAYS } from '@hktours/core';
import type { T } from '../lib/i18n';
import { isImeKeyDown } from '../lib/use-popover-dismiss';
import styles from './GapSelector.module.css';

type Gap = { min: number; max: number };
type Field = keyof Gap;

export interface GapSelectorProps {
  gap: Gap;
  /** Called with the whole new gap, always min ≤ max. */
  onChange: (gap: Gap) => void;
  t: T;
}

/** Keeps only the digits of what was typed, reading full-width digits (from a Chinese input method) as digits. */
function digitsOnly(text: string): string {
  return text.replace(/[０-９]/g, d => String(d.charCodeAt(0) - 0xff10)).replace(/[^0-9]/g, '');
}

/**
 * The rest before the next leg as `[1] – [3] 日`: two text fields that take digits only (a phone shows its
 * number pad), labelled 最少 and 最多 and grouped under 休息.
 *
 * Typing changes only the field. The value is applied when the field loses focus or on Enter (not one that
 * commits an input-method candidate), so typing 1 on the way to 10 does not reload the list. On apply a number
 * above MAX_GAP_DAYS becomes MAX_GAP_DAYS, an empty field goes back to its value, and a minimum above the
 * maximum moves the maximum to match (and the reverse). Applying the gap already shown calls nothing.
 */
export function GapSelector({ gap, onChange, t }: GapSelectorProps) {
  // The applied gap: the address's, or one applied here since and not yet back from the address.
  const [current, setCurrent] = useState(gap);
  const [fromAddress, setFromAddress] = useState(gap);
  if (fromAddress.min !== gap.min || fromAddress.max !== gap.max) {
    setFromAddress(gap);
    setCurrent(gap);
  }
  // What a field shows while it is being typed in; null shows the applied value.
  const [drafts, setDrafts] = useState<Record<Field, string | null>>({ min: null, max: null });

  const type = (field: Field) => (e: ChangeEvent<HTMLInputElement>) => {
    const text = digitsOnly(e.target.value);
    setDrafts(d => ({ ...d, [field]: text }));
  };

  const apply = (field: Field) => {
    const draft = drafts[field];
    setDrafts(d => ({ ...d, [field]: null }));
    if (draft === null || draft === '') return; // nothing typed, or emptied: back to the value it had
    const n = Math.min(Number(draft), MAX_GAP_DAYS);
    const next = field === 'min' ? { min: n, max: Math.max(current.max, n) } : { min: Math.min(current.min, n), max: n };
    if (next.min === current.min && next.max === current.max) return;
    setCurrent(next);
    onChange(next);
  };

  const onKeyDown = (field: Field) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || isImeKeyDown(e)) return;
    e.preventDefault();
    apply(field);
  };

  const input = (field: Field, label: string) => (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        className={styles.input}
        value={drafts[field] ?? String(current[field])}
        onChange={type(field)}
        onKeyDown={onKeyDown(field)}
        onBlur={() => apply(field)}
      />
    </label>
  );

  return (
    <span role="group" aria-label={t('chain.rest')} className={styles.gap}>
      {input('min', t('chain.gapMin'))}
      <span aria-hidden="true">–</span>
      {input('max', t('chain.gapMax'))}
      <span>{t('chain.days')}</span>
    </span>
  );
}
