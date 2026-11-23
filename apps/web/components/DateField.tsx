'use client';

import { useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import type { PlacesIndex } from '@hktours/core';
import type { T } from '../lib/i18n';
import type { DateFestival, DateMonth } from '../lib/band-rows';
import { draftOf, sameSearch, stateFromDraft } from '../lib/filter-sheet';
import { withFilters, type SearchState } from '../lib/search-params';
import { formatCount } from '../lib/format';
import type { SeasonWindow } from '../lib/seasons';
import { Chip, Chips, DateInput, Field, Pair, Section, SheetDialog, SheetFoot, SheetHead, useFilterSheet } from './FilterSheet';
import { SiteLink } from './SiteLink';
import boxStyles from './DestinationScreen.module.css';
import sheetStyles from './FilterSheet.module.css';
import styles from './DateField.module.css';

/** The date sheet's id and the mark on its history entry (the filter sheet has its own). */
export const DATE_SHEET_ID = 'date-sheet';
const HISTORY_KEY = 'dateSheet';

const noSubscription = () => () => {};

/** What the date sheet offers and says (lib/band-rows.ts bandDates, or the trip's choosing screen's own). */
export interface DateChoices {
  /** The field's text once dates are chosen; null for its placeholder. */
  value: string | null;
  festivals: DateFestival[];
  months: DateMonth[];
  /** The 這段日子是 switch: the travel window as well as the departure window (not on the trip's choosing screen). */
  travel: boolean;
}

export interface DateFieldProps {
  t: T; places: PlacesIndex;
  state: SearchState;
  choices: DateChoices;
  /** Goes to `next`; `festival` when its dates are exactly a festival's and are the departure window. */
  onApply: (next: SearchState, festival: SeasonWindow | null) => void;
  /** ✕: a link (the band: the page with no dates, made on the server), or else the field clears through onApply. */
  clearHref?: string;
  /** Where the field leads before the page runs (the filter sheet's in-page form); none: plain text until then. */
  fallbackHref?: string;
}

/** The dates a state's field and sheet start from: its departure window, else its travel window. */
function initial(state: SearchState) {
  const f = state.filters;
  if (f.dateFrom || f.dateTo) return { from: f.dateFrom ?? '', to: f.dateTo ?? '', travel: false };
  if (f.travelFrom || f.travelTo) return { from: f.travelFrom ?? '', to: f.travelTo ?? '', travel: true };
  return { from: '', to: '', travel: false };
}

/**
 * The phone's 幾時出發？ field and its date sheet (task 78, the owner's drawings M22, M24 and M25): under the search
 * box, a field of the same look that opens the sheet; once dates are chosen it shows them, with ✕ (its own 44px
 * target) to clear them. The sheet is the filter sheet's dialog and parts (components/FilterSheet: the same focus,
 * Escape, Back, page that does not scroll, 清除 and 顯示結果): 節日 (the festivals with their days and counts), 月份
 * (the months with tours), 自訂日期 (from / to), and 這段日子是: 這幾天出發 (the departure window, from/to) or
 * 整個旅程都在這幾天內 (the travel window, tfrom/tto). Choosing applies through the address rules (lib/filter-sheet.ts
 * stateFromDraft), one navigation, after the sheet's history entry is gone.
 *
 * Without JavaScript the field is a link to the filter sheet's in-page form (`fallbackHref`), whose date fields are
 * there then; the sheet itself is only made in the browser.
 */
export function DateField({ t, places, state, choices, onApply, clearHref, fallbackHref }: DateFieldProps) {
  const openerRef = useRef<HTMLButtonElement>(null);
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const control = useFilterSheet<{ next: SearchState; festival: SeasonWindow | null }>(
    ({ next, festival }) => onApply(next, festival), openerRef, HISTORY_KEY,
  );
  const cleared = withFilters(state, { dateFrom: undefined, dateTo: undefined, travelFrom: undefined, travelTo: undefined });

  const content = (
    <>
      <CalendarIcon />
      <span className={choices.value ? `${boxStyles.value} ${styles.oneLine}` : `${boxStyles.placeholder} ${styles.oneLine}`}>
        {choices.value ?? t('dates.placeholder')}
      </span>
    </>
  );
  let box: ReactNode;
  if (hydrated) {
    box = <button ref={openerRef} type="button" className={boxStyles.box} aria-haspopup="dialog" onClick={control.openSheet}>{content}</button>;
  } else if (fallbackHref !== undefined) {
    box = <a className={boxStyles.box} href={fallbackHref}>{content}</a>;
  } else {
    box = <span className={boxStyles.box}>{content}</span>;
  }
  const clearLabel = choices.value ? t('dates.clear', { value: choices.value }) : '';

  return (
    <div className={choices.value ? `${boxStyles.searchBox} ${boxStyles.withClear}` : boxStyles.searchBox}>
      {box}
      {choices.value && (clearHref !== undefined
        ? <SiteLink className={boxStyles.clear} href={clearHref} aria-label={clearLabel}><span aria-hidden="true">✕</span></SiteLink>
        : hydrated && (
          <button type="button" className={boxStyles.clear} aria-label={clearLabel} onClick={() => onApply(cleared, null)}>
            <span aria-hidden="true">✕</span>
          </button>
        ))}
      {hydrated && (
        <SheetDialog id={DATE_SHEET_ID} titleId={`${DATE_SHEET_ID}-title`} control={control} hydrated>
          {close => <DateSheetForm key={control.round} t={t} places={places} state={state} choices={choices} onDone={close} />}
        </SheetDialog>
      )}
    </div>
  );
}

function DateSheetForm({ t, places, state, choices, onDone }: {
  t: T; places: PlacesIndex; state: SearchState; choices: DateChoices;
  onDone: (next: { next: SearchState; festival: SeasonWindow | null } | null) => void;
}) {
  const [draft, setDraft] = useState(() => initial(state));
  const set = (patch: Partial<typeof draft>) => setDraft(current => ({ ...current, ...patch }));
  const titleId = `${DATE_SHEET_ID}-title`;
  const hintId = `${DATE_SHEET_ID}-mode-hint`;
  const travel = choices.travel && draft.travel;
  const isOn = (from: string, to: string) => draft.from === from && draft.to === to;
  const pick = (from: string, to: string) => set(isOn(from, to) ? { from: '', to: '' } : { from, to });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Through the address rules, as the filter sheet's fields: one window set, the other cleared.
    const dates = travel ? { from: '', to: '', tfrom: draft.from, tto: draft.to } : { from: draft.from, to: draft.to, tfrom: '', tto: '' };
    const next = stateFromDraft(state, { ...draftOf(state), ...dates }, { dates: true, travel: choices.travel, operators: false, exclude: false }, places);
    const festival = travel ? null : choices.festivals.find(f => isOn(f.window.from, f.window.to))?.window ?? null;
    onDone(sameSearch(next, state) ? null : { next, festival });
  };

  return (
    <form className={sheetStyles.form} onSubmit={submit}>
      <SheetHead
        titleId={titleId} title={t('dates.placeholder')} closeLabel={t('filter.close')} hydrated closeHref="#" onClose={() => onDone(null)}
      />
      <div className={sheetStyles.body}>
        {choices.festivals.length > 0 && (
          <Section id={`${DATE_SHEET_ID}-festivals`} title={t('dates.festivals')}>
            <Chips>
              {choices.festivals.map(f => (
                <Chip key={f.key} pressed={isOn(f.window.from, f.window.to)} disabled={!f.enabled} onClick={() => pick(f.window.from, f.window.to)}>
                  <span className={styles.festival}>
                    <span className={styles.festivalName}>{f.name}</span>
                    <span className={styles.festivalDays}>{f.tours === null ? f.days : `${f.days} · ${t('dest.tours', { n: formatCount(f.tours) })}`}</span>
                  </span>
                </Chip>
              ))}
            </Chips>
          </Section>
        )}
        {choices.months.length > 0 && (
          <Section id={`${DATE_SHEET_ID}-months`} title={t('dates.months')}>
            <Chips>
              {choices.months.map(m => <Chip key={m.key} pressed={isOn(m.from, m.to)} onClick={() => pick(m.from, m.to)}>{m.label}</Chip>)}
            </Chips>
          </Section>
        )}
        <Section id={`${DATE_SHEET_ID}-custom`} title={t('dates.custom')}>
          <Pair>
            <Field date label={t('filter.from')}><DateInput value={draft.from} onChange={from => set({ from })} /></Field>
            <Field date label={t('filter.to')}><DateInput value={draft.to} onChange={to => set({ to })} /></Field>
          </Pair>
        </Section>
        {choices.travel && (
          <Section id={`${DATE_SHEET_ID}-mode`} title={t('dates.mode')}>
            <div className={styles.modes} aria-describedby={hintId}>
              <Chip pressed={!draft.travel} onClick={() => set({ travel: false })}>{t('dates.modeLeave')}</Chip>
              <Chip pressed={draft.travel} onClick={() => set({ travel: true })}>{t('dates.modeWithin')}</Chip>
            </div>
            <p id={hintId} className={sheetStyles.hint}>{t('dates.modeWithinHint')}</p>
          </Section>
        )}
      </div>
      <SheetFoot
        hydrated clearLabel={t('dates.clearAll')} applyLabel={t('filter.showResults')}
        onClear={() => set({ from: '', to: '' })}
      />
    </form>
  );
}

/** A calendar: its rings and a row of days, in the box's text colour. */
function CalendarIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M4 6.5h16v13H4zM4 10.5h16M8 4v4M16 4v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
