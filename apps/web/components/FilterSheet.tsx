'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from 'react';
import { groupCountries, type IsoDate, type OperatorId, type PlacesIndex } from '@hktours/core';
import type { DateWindow, OperatorInfo } from '@hktours/db/read';
import type { T } from '../lib/i18n';
import { operatorTagStyle } from '../lib/contrast';
import { formatPrice } from '../lib/format';
import {
  DAY_PRESETS, SHEET_PRICE_CEILINGS, clearedState, draftOf, monthWindow, sameSearch, stateFromDraft,
  type SheetDraft, type SheetSections,
} from '../lib/filter-sheet';
import { DAYS_RANGE, PRICE_RANGE, type SearchState } from '../lib/search-params';
import { SEASON_NAME_KEYS, type SeasonWindow } from '../lib/seasons';
import { operatorName, placeName } from '../lib/place-names';
import styles from './FilterSheet.module.css';

/** The sheet's id: 篩選's target without JavaScript ('#filter-sheet'). One filter bar per page. */
export const SHEET_ID = 'filter-sheet';

/** The mark on the history entry the open sheet adds, so the browser's Back closes it. */
const HISTORY_KEY = 'filterSheet';

/** Countries never offered for exclusion, as in the destination panels and the wide row. */
const HIDDEN_COUNTRY_IDS = ['hongkong'];

/**
 * Set when the sheet's choices are applied, to the address they were applied on. The next address may be another
 * route (the home page's stored copy and its per-request copy are two), whose new bar then puts the focus back on
 * 篩選; on the same route the bar keeps it. Only a render on another address uses it up: the renders on the old one
 * (the page put back after going back over the sheet's entry) leave it for the new page.
 */
let focusOpenerAfterLeaving: string | null = null;

const currentAddress = () => window.location.pathname + window.location.search;

const onSheetEntry = () => (window.history.state as Record<string, unknown> | null)?.[HISTORY_KEY] === true;

export interface FilterSheetControl {
  open: boolean;
  /** Counts the openings: each one starts from the page's filters (unapplied choices are not kept). */
  round: number;
  /** Opens the sheet, adding a history entry (Back closes it again). */
  openSheet: () => void;
  /** Ask to apply `next` (null: nothing changed) once the sheet has closed. */
  setPending: (next: SearchState | null) => void;
  /** The dialog has closed, however it was closed. */
  closed: () => void;
}

/**
 * The open/closed state of the phone filter sheet and its history entry. Opening adds an entry for the same address
 * (Next.js keeps its own state in it), so the browser's Back (and a phone's back gesture) closes the sheet without
 * leaving the page; Forward opens it again. Closing it any other way (×, Escape, 顯示結果) goes back over that entry
 * first, and only then does 顯示結果 navigate (`apply`): one navigation, and the entry is never left behind. A reload
 * while it is open comes back with it open (the entry keeps its mark), on the page's applied filters. Focus goes back
 * to `opener` once it is closed.
 */
export function useFilterSheet(apply: (next: SearchState) => void, opener: RefObject<HTMLElement | null>): FilterSheetControl {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const openRef = useRef(false);
  const pending = useRef<SearchState | null>(null);
  const waitingForBack = useRef(false);
  const applyRef = useRef(apply);
  useEffect(() => { applyRef.current = apply; });

  const show = useCallback(() => {
    if (openRef.current) return;
    openRef.current = true;
    setRound(r => r + 1);
    setOpen(true);
  }, []);

  const finish = useCallback(() => {
    const next = pending.current;
    pending.current = null;
    if (!next) return;
    focusOpenerAfterLeaving = currentAddress();
    applyRef.current(next);
  }, []);

  // The first render on the new address after the choices were applied (this bar's, or a new route's bar's) puts the
  // focus on 篩選.
  useEffect(() => {
    if (focusOpenerAfterLeaving === null || focusOpenerAfterLeaving === currentAddress() || !opener.current) return;
    focusOpenerAfterLeaving = null;
    if (document.activeElement !== opener.current) opener.current.focus({ preventScroll: true });
  });

  useEffect(() => {
    // Reloaded on the sheet's entry: open it again.
    if (onSheetEntry()) show();
    const onPopState = () => {
      // After every other listener of this event: Next.js restores the page it went back to, and only then may the
      // new address be pushed (this listener is added first, so straight away the restore would undo the push).
      if (waitingForBack.current) { waitingForBack.current = false; setTimeout(finish, 0); return; }
      if (onSheetEntry()) show();
      else if (openRef.current) { openRef.current = false; setOpen(false); }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [show, finish]);

  return {
    open, round,
    openSheet: () => {
      if (!onSheetEntry()) window.history.pushState({ ...(window.history.state as object | null), [HISTORY_KEY]: true }, '');
      show();
    },
    setPending: next => { pending.current = next; },
    closed: () => {
      openRef.current = false;
      setOpen(false);
      opener.current?.focus({ preventScroll: true });
      if (onSheetEntry()) { waitingForBack.current = true; window.history.back(); } else finish();
    },
  };
}

export interface FilterSheetProps {
  control: FilterSheetControl;
  state: SearchState; operators: OperatorInfo[]; places: PlacesIndex; t: T; today: IsoDate;
  sections: SheetSections;
  /** The seasons offered as one-tap departure windows (lib/filter-sheet.ts sheetSeasons). */
  seasons: SeasonWindow[];
  /** A season page's days, fixed by its path: 清除全部 keeps them, and without JavaScript they cannot be changed here. */
  fixedDates: DateWindow | null;
  /**
   * The address 清除全部 leaves (with the page's language), when the page can say it: the form's target without
   * JavaScript (a GET form, its query carried in hidden fields), and 清除全部's link there. Without it (the trip page,
   * whose addresses carry its own state) the sheet needs JavaScript, as every filter did before.
   */
  clearHref?: string;
  /**
   * The departure dates when the page sets them itself (the trip's choosing screen for a later tour: the trip and its
   * rest setting): the 出發日期 section is this one plain line, with no fields (task 75).
   */
  datesNote?: string;
  /** Rendered in the browser: the one-tap choices and the buttons work (without JavaScript they are links or hidden). */
  hydrated: boolean;
  /** The bar's id, where the × goes without JavaScript. */
  barId: string;
}

/**
 * The phone filter sheet (the owner's drawing Mobile3Filters): a full-height modal dialog (the browser's own: focus
 * moves in and stays in, the page behind is inert and does not scroll, Escape closes it) holding every filter the
 * page's row has, in sections: departure dates (one-tap seasons with tours, this month and next month, then the two
 * date fields), length (one-tap ranges, then the two fields), price per person (one-tap ceilings, then lowest and
 * highest), operators (chips in their colours), the travel window, and on the trip page the countries left out. The
 * choices are applied together by 顯示結果 (one navigation, through the address rules); 清除全部 empties them.
 *
 * Without JavaScript, 篩選 is a link to '#filter-sheet' and the sheet shows itself as that link's target (CSS
 * :target): a GET form to the page's address with every field named as the address names it; the one-tap choices
 * need JavaScript and are left out.
 */
export function FilterSheet(props: FilterSheetProps) {
  const { control, hydrated } = props;
  const ref = useRef<HTMLDialogElement>(null);
  // Fixed ids (one sheet per page), not useId: the stored home page and its per-request copy render the same text.
  const titleId = `${SHEET_ID}-title`;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (control.open && !dialog.open) dialog.showModal();
    else if (!control.open && dialog.open) dialog.close();
  }, [control.open]);

  const close = (next: SearchState | null) => {
    control.setPending(next);
    ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      id={SHEET_ID}
      className={styles.sheet}
      aria-labelledby={titleId}
      data-js={hydrated ? '' : undefined}
      onClose={control.closed}
    >
      {/* A fresh form for each opening, filled from the page's filters. */}
      <SheetForm key={control.round} {...props} titleId={titleId} onDone={close} />
    </dialog>
  );
}

function SheetForm({ state, operators, places, t, today, sections, seasons, fixedDates, clearHref, datesNote, hydrated, barId, titleId, onDone }:
  FilterSheetProps & { titleId: string; onDone: (next: SearchState | null) => void }) {
  const [draft, setDraft] = useState<SheetDraft>(() => draftOf(state));
  const set = (patch: Partial<SheetDraft>) => setDraft(current => ({ ...current, ...patch }));
  const groupIdPrefix = `${SHEET_ID}-group`;
  const hintId = `${SHEET_ID}-travel-hint`;

  // Without JavaScript the form goes to the page's address; its query (the order, a season page's destination…) rides
  // along in hidden fields, and the fields are named as the address names them.
  const target = clearHref === undefined ? null : new URL(clearHref, 'https://site.invalid');
  const name = (n: string) => (target ? n : undefined);
  const datesFixed = fixedDates !== null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = stateFromDraft(state, draft, sections, places);
    onDone(sameSearch(next, state) ? null : next);
  };

  const windowChip = (key: string, label: string, w: DateWindow) => {
    const on = draft.from === w.from && draft.to === w.to;
    return (
      <Chip key={key} pressed={on} onClick={() => set(on ? { from: '', to: '' } : { from: w.from, to: w.to })}>{label}</Chip>
    );
  };

  return (
    <form
      className={styles.form}
      method={target ? 'get' : undefined}
      action={target ? target.pathname : undefined}
      onSubmit={submit}
    >
      {target && [...target.searchParams].map(([n, v]) => <input key={n} type="hidden" name={n} value={v} />)}

      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>{t('filter.sheet')}</h2>
        {hydrated
          ? <button type="button" className={styles.close} aria-label={t('filter.close')} onClick={() => onDone(null)}>×</button>
          : <a className={styles.close} href={`#${barId}`} aria-label={t('filter.close')}>×</a>}
      </div>

      <div className={styles.body}>
        {sections.dates && (
          <Section id={`${SHEET_ID}-dates`} title={t('filter.dates')}>
            {hydrated && (
              <Chips>
                {seasons.map(s => windowChip(s.season, t(SEASON_NAME_KEYS[s.season].name), s))}
                {windowChip('this', t('filter.thisMonth'), monthWindow(today, 0))}
                {windowChip('next', t('filter.nextMonth'), monthWindow(today, 1))}
              </Chips>
            )}
            <Pair>
              <Field date label={t('filter.from')}>
                <input className={styles.input} type="date" name={datesFixed ? undefined : name('from')} value={draft.from} onChange={e => set({ from: e.target.value })} />
              </Field>
              <Field date label={t('filter.to')}>
                <input className={styles.input} type="date" name={datesFixed ? undefined : name('to')} value={draft.to} onChange={e => set({ to: e.target.value })} />
              </Field>
            </Pair>
          </Section>
        )}
        {!sections.dates && datesNote !== undefined && (
          <Section id={`${SHEET_ID}-dates`} title={t('filter.dates')}>
            <p className={styles.note}>{datesNote}</p>
          </Section>
        )}

        <Section id={`${SHEET_ID}-days`} title={t('filter.days')}>
          {hydrated && (
            <Chips>
              {DAY_PRESETS.map(p => {
                const min = String(p.min);
                const max = p.max === undefined ? '' : String(p.max);
                const on = draft.dmin === min && draft.dmax === max;
                const label = p.max === undefined ? t('filter.daysPlus', { min: p.min }) : t('filter.daysRange', { min: p.min, max: p.max });
                return <Chip key={p.min} pressed={on} onClick={() => set(on ? { dmin: '', dmax: '' } : { dmin: min, dmax: max })}>{label}</Chip>;
              })}
            </Chips>
          )}
          <Pair>
            <Field label={t('filter.from')}>
              <NumberInput name={name('dmin')} bounds={DAYS_RANGE} value={draft.dmin} onChange={dmin => set({ dmin })} />
            </Field>
            <Field label={t('filter.to')}>
              <NumberInput name={name('dmax')} bounds={DAYS_RANGE} value={draft.dmax} onChange={dmax => set({ dmax })} />
            </Field>
          </Pair>
        </Section>

        <Section id={`${SHEET_ID}-price`} title={t('filter.pricePerPerson')}>
          {hydrated && (
            <Chips>
              {SHEET_PRICE_CEILINGS.map(max => {
                const on = draft.pmin === '' && draft.pmax === String(max);
                return (
                  <Chip key={max} pressed={on} onClick={() => set(on ? { pmax: '' } : { pmin: '', pmax: String(max) })}>
                    {t('filter.priceUnder', { max: formatPrice(max) })}
                  </Chip>
                );
              })}
            </Chips>
          )}
          <Pair>
            <Field label={t('filter.priceLowest')}>
              <NumberInput name={name('pmin')} bounds={PRICE_RANGE} value={draft.pmin} onChange={pmin => set({ pmin })} />
            </Field>
            <Field label={t('filter.priceHighest')}>
              <NumberInput name={name('pmax')} bounds={PRICE_RANGE} value={draft.pmax} onChange={pmax => set({ pmax })} />
            </Field>
          </Pair>
        </Section>

        {sections.operators && (
          <Section id={`${SHEET_ID}-operators`} title={t('filter.operators')}>
            <div className={styles.chips}>
              {operators.map(op => (
                <CheckChip
                  key={op.id} name={name('op')} value={op.id}
                  checked={draft.op.includes(op.id)}
                  onChange={() => set({ op: toggle(draft.op, op.id) })}
                  dotStyle={operatorTagStyle(op.color).style}
                >
                  {operatorName(op, t.locale)}
                </CheckChip>
              ))}
            </div>
          </Section>
        )}

        {(sections.travel ?? sections.dates) && (
          <Section id={`${SHEET_ID}-travel`} title={t('filter.travel')}>
            <p id={hintId} className={styles.hint}>{t('filter.travelHint')}</p>
            <Pair>
              <Field date label={t('filter.travelFrom')}>
                <input className={styles.input} type="date" name={name('tfrom')} aria-describedby={hintId} value={draft.tfrom} onChange={e => set({ tfrom: e.target.value })} />
              </Field>
              <Field date label={t('filter.travelTo')}>
                <input className={styles.input} type="date" name={name('tto')} aria-describedby={hintId} value={draft.tto} onChange={e => set({ tto: e.target.value })} />
              </Field>
            </Pair>
          </Section>
        )}

        {sections.exclude && (
          // One row, 排除國家：無 ▾ (task 75), that opens the countries in place: a native disclosure, closed at each
          // opening of the sheet, working without JavaScript too. Its count is what the boxes ticked now say.
          <div role="group" aria-labelledby={`${SHEET_ID}-exclude`} className={styles.section}>
            <details className={styles.disclosure}>
              <summary id={`${SHEET_ID}-exclude`} className={styles.summary}>
                {draft.ex.length === 0 ? t('filter.excludeNone') : t('filter.excludeSome', { n: draft.ex.length })}
                <span className={styles.summaryMark} aria-hidden="true">▾</span>
              </summary>
              {groupCountries(places.data.countries.filter(c => !HIDDEN_COUNTRY_IDS.includes(c.id))).map(g => (
                // Grouped by part of the world, as in the destination panel.
                <div key={g.id} role="group" aria-labelledby={`${groupIdPrefix}-${g.id}`} className={styles.group}>
                  <div id={`${groupIdPrefix}-${g.id}`} className={styles.groupLabel}>{t(`countryGroup.${g.id}`)}</div>
                  <div className={styles.chips}>
                    {g.countries.map(c => (
                      <CheckChip key={c.id} name={name('ex')} value={c.id} checked={draft.ex.includes(c.id)} onChange={() => set({ ex: toggle(draft.ex, c.id) })}>
                        {placeName(c, t.locale)}
                      </CheckChip>
                    ))}
                  </div>
                </div>
              ))}
            </details>
          </div>
        )}
      </div>

      <div className={styles.foot}>
        {hydrated
          ? <button type="button" className={styles.clear} onClick={() => setDraft(draftOf(clearedState(state, sections, fixedDates)))}>{t('filter.clearAll')}</button>
          : clearHref !== undefined && <a className={styles.clear} href={clearHref}>{t('filter.clearAll')}</a>}
        <button type="submit" className={styles.apply}>{t('filter.showResults')}</button>
      </div>
    </form>
  );
}

function toggle<V extends string>(list: V[], value: V): V[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
}

/** A section: its name over its choices, read out as a group with that name. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id} className={styles.section}>
      <h3 id={id} className={styles.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

function Chips({ children }: { children: ReactNode }) {
  return <div className={styles.chips}>{children}</div>;
}

/** A one-tap choice: pressed while the fields hold exactly its values; pressed again, it empties them. */
function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={styles.chip} aria-pressed={pressed} onClick={onClick}>{children}</button>;
}

/** A tickable chip (an operator, a country): a real checkbox inside, so it works the same without JavaScript. */
function CheckChip({ name, value, checked, onChange, dotStyle, children }: {
  name?: string; value: OperatorId | string; checked: boolean; onChange: () => void; dotStyle?: CSSProperties; children: ReactNode;
}) {
  return (
    <label className={styles.checkChip}>
      <input type="checkbox" className={styles.checkInput} name={name} value={value} checked={checked} onChange={onChange} />
      {dotStyle && <span data-dot="" className={styles.dot} style={dotStyle} />}
      {children}
      {checked && <span aria-hidden="true" className={styles.tick}>✓</span>}
    </label>
  );
}

function Pair({ children }: { children: ReactNode }) {
  return <div className={styles.pair}>{children}</div>;
}

/** A labelled field; a date field (`date`) needs more room, so a pair of them stacks sooner on a narrow screen. */
function Field({ label, date, children }: { label: string; date?: boolean; children: ReactNode }) {
  return (
    <label className={date ? `${styles.field} ${styles.dateField}` : styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

/** A whole number within the address's bounds (the browser checks them before the form is applied, as in the row). */
function NumberInput({ name, bounds, value, onChange }: { name?: string; bounds: { min: number; max: number }; value: string; onChange: (v: string) => void }) {
  return (
    <input
      className={styles.input} type="number" name={name} min={bounds.min} max={bounds.max} step={1} inputMode="numeric"
      value={value} onChange={e => onChange(e.target.value)}
    />
  );
}
