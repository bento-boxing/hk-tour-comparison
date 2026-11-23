'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { OPERATOR_IDS, groupCountries, todayInHongKong, type IsoDate, type OperatorId, type PlacesIndex } from '@hktours/core';
import type { DateWindow, OperatorInfo, SortKey, TourFilters } from '@hktours/db/read';
import type { DictKey, T } from '../lib/i18n';
import { operatorTagStyle } from '../lib/contrast';
import { formatChipDate, formatCount, formatPrice } from '../lib/format';
import {
  buildSearchQuery, parseSearchParams, withFilters, DAYS_RANGE, DEFAULT_SORT, PRICE_RANGE, type SearchState,
} from '../lib/search-params';
import { operatorName, placeName } from '../lib/place-names';
import { DAY_PRESETS, activeFilterCount, clearedState, type SheetSections } from '../lib/filter-sheet';
import type { SeasonWindow } from '../lib/seasons';
import { destinationLabel } from './DestinationSearch';
import { FilterPopover } from './FilterPopover';
import { FilterSheet, SHEET_ID, useFilterSheet } from './FilterSheet';
import styles from './FilterBar.module.css';

export interface FilterBarProps {
  state: SearchState; operators: OperatorInfo[]; places: PlacesIndex; t: T;
  /** Called with the whole next state, always back on page 1. */
  onChange: (next: SearchState) => void;
  /**
   * dates (both the departure and the travel window) defaults to true, exclude to false; the chain page flips both.
   * operators defaults to true; an operator's page, whose operator is fixed by its path, turns it off.
   */
  show?: { dates?: boolean; exclude?: boolean; operators?: boolean };
  /** Hong Kong today, for the date pill's year rule; pass the server's, so server and browser render the same label. */
  today?: IsoDate;
  // Phones only (under 1024px), for the bar and its filter sheet; a page that does not know one leaves it out.
  /** The number of tours the page found, shown at the bar's right end. */
  total?: number;
  /** The seasons the sheet offers as one-tap departure windows (lib/filter-sheet.ts sheetSeasons). */
  seasons?: SeasonWindow[];
  /** A season page's days, fixed by its path: not counted on the badge, and kept by 清除全部. */
  fixedDates?: DateWindow | null;
  /**
   * The address (with the page's language) of a state on this page, as onChange goes to it: given, the sheet works
   * without JavaScript too (a GET form to the address 清除全部 leaves).
   */
  hrefFor?: (state: SearchState) => string;
}

type PillId = 'dates' | 'travel' | 'days' | 'price' | 'operators' | 'exclude' | 'sort';


/** The sort popover's rows: each order with its two directions, so eight choices fit a phone as four short rows. */
const SORT_ROWS = [
  { by: 'price', keys: ['price', 'price-desc'] },
  { by: 'days', keys: ['days', 'days-desc'] },
  { by: 'date', keys: ['date', 'date-desc'] },
  { by: 'destination', keys: ['destination', 'destination-desc'] },
] as const satisfies readonly { by: string; keys: readonly [SortKey, SortKey] }[];

/** The bar's id: where the sheet's × goes without JavaScript. One filter bar per page. */
const BAR_ID = 'filter-bar';

const noSubscription = () => () => {};

/** Countries never offered for exclusion, as in the destination panels. */
const HIDDEN_COUNTRY_IDS = ['hongkong'];

/** '12/1 – 12/31'; a date outside today's year shows its year, as on the cards: '12/20 – 2027/1/10'. */
function datesText(from: IsoDate | undefined, to: IsoDate | undefined, today: IsoDate, t: T): string | null {
  const date = (d: IsoDate) => formatChipDate(d, today, t);
  if (from && to) return `${date(from)} – ${date(to)}`;
  if (from) return `${date(from)} –`;
  if (to) return `– ${date(to)}`;
  return null;
}

/** A reversed pair of typed dates is swapped, as for the number ranges (in the address, a reversed pair is dropped). */
const inOrder = (from: string, to: string): [string, string] => (from && to && from > to ? [to, from] : [from, to]);

function daysText(min: number | undefined, max: number | undefined, t: T): string | null {
  if (min === undefined && max === undefined) return null;
  if (max === undefined) return t('filter.daysPlus', { min: min ?? DAYS_RANGE.min });
  const from = min ?? DAYS_RANGE.min;
  // One length ('1 day', '5日'), never a range from a number to itself.
  return from === max ? t('length.days', { days: max }) : t('filter.daysRange', { min: from, max });
}

function priceText(f: TourFilters, t: T): string | null {
  if (f.priceMin !== undefined && f.priceMax !== undefined) return `${formatPrice(f.priceMin)}–${formatCount(f.priceMax)}`;
  if (f.priceMin !== undefined) return t('filter.pricePlus', { min: formatPrice(f.priceMin) });
  if (f.priceMax !== undefined) return `${formatPrice(PRICE_RANGE.min)}–${formatCount(f.priceMax)}`;
  return null;
}

/**
 * The filter row (mock-up Rows): outlined boxes in this order: destination (only when set, with ✕ to clear),
 * departure dates, travel dates, length, price, operators (unless turned off), exclusions (only when asked); a box whose filter is set
 * is filled. Then, at the right end of the row, the sort control, set apart by its heavier outline.
 *
 * Under 1024px the row is one bar instead (the owner's drawing Mobile6Home), stuck to the top of the window while the
 * list scrolls: 篩選 (with a badge counting the filters that are on: lib/filter-sheet.ts activeFilterCount), the same
 * sort control showing the current order, and the number of tours. 篩選 opens the filter sheet (FilterSheet), which
 * holds every box of the row; the destination stays with the band. Both are drawn at every width and shown by CSS.
 */
export function FilterBar({ state, operators, places, t, onChange, show, today = todayInHongKong(), total, seasons = [], fixedDates = null, hrefFor }: FilterBarProps) {
  const showDates = show?.dates ?? true;
  const showExclude = show?.exclude ?? false;
  const showOperators = show?.operators ?? true;
  const sections: SheetSections = { dates: showDates, operators: showOperators, exclude: showExclude };
  const f = state.filters;
  const barRef = useRef<HTMLDivElement>(null);
  const sheetOpenerRef = useRef<HTMLElement>(null);
  const groupIdPrefix = useId();
  const sheet = useFilterSheet(onChange, sheetOpenerRef);
  // Until the browser runs the page, 篩選 is a link to the sheet (shown by CSS as its target) and its one-tap
  // choices are left out; then it is a button opening the sheet as a modal dialog.
  // (false in the server's HTML and while it hydrates; a bar first mounted in the browser, on another page, starts as
  // the button, never as a link swapped out from under the focus.)
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  useStickBelowNotice();
  const clearHref = hrefFor?.(clearedState(state, sections, fixedDates));
  const onCount = activeFilterCount(state, sections, fixedDates);

  // At most one popover is open: opening a pill closes any other.
  const [openPill, setOpenPill] = useState<PillId | null>(null);
  const popover = (id: PillId) => ({
    open: openPill === id,
    // A late close from one pill never closes another that has opened since.
    onOpenChange: (open: boolean) => setOpenPill(current => (open ? id : current === id ? null : current)),
  });

  const pillLabel = (name: DictKey, value: string | null) => t('filter.label', { name: t(name), value: value ?? t('filter.all') });
  const update = (patch: Partial<TourFilters>) => onChange(withFilters(state, patch));
  // Typed values go through the same rules as the address, so the bar never sets a filter a reload would drop.
  const applyTyped = (changes: Record<string, string>) => {
    const current = Object.fromEntries(buildSearchQuery({ ...state, page: 1 }));
    onChange(parseSearchParams({ ...current, ...changes }, places));
  };

  const clearDestination = () => {
    // The pill disappears once the new address renders, so move focus to the next pill now.
    // (Not the phones' 篩選, unseen on a wide screen; under 1024px there is no destination pill.)
    barRef.current?.querySelector<HTMLElement>(`[aria-haspopup]:not(.${styles.sheetButton})`)?.focus({ preventScroll: true });
    update({ destination: undefined });
  };

  const operatorNameOf = (id: OperatorId) => {
    const op = operators.find(o => o.id === id);
    return op ? operatorName(op, t.locale) : id;
  };
  const selectedOperators = f.operators ?? [];
  const toggleOperator = (id: OperatorId) => {
    const next = new Set(selectedOperators);
    if (next.has(id)) next.delete(id); else next.add(id);
    update({ operators: OPERATOR_IDS.filter(o => next.has(o)) });
  };

  const excluded = f.excludeCountryIds ?? [];
  const toggleExcluded = (id: string) =>
    update({ excludeCountryIds: excluded.includes(id) ? excluded.filter(c => c !== id) : [...excluded, id] });
  const countryName = (id: string) => {
    const country = places.country(id);
    return country ? placeName(country, t.locale) : id;
  };

  const days = daysText(f.daysMin, f.daysMax, t);
  const price = priceText(f, t);
  const dates = datesText(f.dateFrom, f.dateTo, today, t);
  const travel = datesText(f.travelFrom, f.travelTo, today, t);
  const separator = t('dest.listSeparator');

  const sheetButtonContent = (
    <>
      <FilterIcon />
      {t('filter.sheet')}
      {onCount > 0 && (
        <>
          <span className={styles.badge} aria-hidden="true">{onCount}</span>
          <span className={styles.visuallyHidden}>{t('filter.onCount', { n: onCount })}</span>
        </>
      )}
    </>
  );

  return (
    <>
    <div ref={barRef} id={BAR_ID} className={styles.filters} data-filter-bar="">
      {/* Phones only: 篩選. A link to the sheet without JavaScript, where the page can say its addresses. */}
      {!hydrated && clearHref !== undefined ? (
        <a ref={el => { sheetOpenerRef.current = el; }} href={`#${SHEET_ID}`} className={styles.sheetButton}>{sheetButtonContent}</a>
      ) : (
        <button
          ref={el => { sheetOpenerRef.current = el; }}
          type="button" className={styles.sheetButton} aria-haspopup="dialog" aria-expanded={sheet.open}
          onClick={sheet.openSheet}
        >
          {sheetButtonContent}
        </button>
      )}

      {f.destination && (
        <button
          type="button"
          className={styles.f}
          data-on="true"
          aria-label={t('filter.clearDestination', { dest: destinationLabel(f.destination, places, t) })}
          onClick={clearDestination}
        >
          {destinationLabel(f.destination, places, t)} ✕
        </button>
      )}

      {showDates && (
        <FilterPopover {...popover('dates')} label={pillLabel('filter.dates', dates)} title={t('filter.dates')} on={dates !== null}>
          {done => (
            <RangeForm
              type="date" t={t}
              from={f.dateFrom ?? ''} to={f.dateTo ?? ''}
              onApply={(a, b) => { const [from, to] = inOrder(a, b); applyTyped({ from, to }); done(); }}
              onReset={() => { update({ dateFrom: undefined, dateTo: undefined }); done(); }}
            />
          )}
        </FilterPopover>
      )}

      {showDates && (
        // The visitor's free dates: only tours that leave and come back inside them. Applies with 出發日期.
        <FilterPopover {...popover('travel')} label={pillLabel('filter.travel', travel)} title={t('filter.travel')} on={travel !== null}>
          {done => (
            <RangeForm
              type="date" t={t} hint={t('filter.travelHint')}
              from={f.travelFrom ?? ''} to={f.travelTo ?? ''}
              onApply={(a, b) => { const [tfrom, tto] = inOrder(a, b); applyTyped({ tfrom, tto }); done(); }}
              onReset={() => { update({ travelFrom: undefined, travelTo: undefined }); done(); }}
            />
          )}
        </FilterPopover>
      )}

      <FilterPopover {...popover('days')} label={pillLabel('filter.days', days)} title={t('filter.days')} on={days !== null}>
        {done => (
          <>
            <div className={styles.presets}>
              {DAY_PRESETS.map(p => (
                <button
                  key={p.min}
                  type="button"
                  className={styles.chip}
                  aria-pressed={f.daysMin === p.min && f.daysMax === p.max}
                  onClick={() => { update({ daysMin: p.min, daysMax: p.max }); done(); }}
                >
                  {daysText(p.min, p.max, t)}
                </button>
              ))}
            </div>
            <RangeForm
              type="number" bounds={DAYS_RANGE} t={t}
              from={f.daysMin?.toString() ?? ''} to={f.daysMax?.toString() ?? ''}
              onApply={(dmin, dmax) => { applyTyped({ dmin, dmax }); done(); }}
              onReset={() => { update({ daysMin: undefined, daysMax: undefined }); done(); }}
            />
          </>
        )}
      </FilterPopover>

      <FilterPopover {...popover('price')} label={pillLabel('filter.price', price)} title={t('filter.price')} on={price !== null}>
        {done => (
          <RangeForm
            type="number" bounds={PRICE_RANGE} t={t}
            from={f.priceMin?.toString() ?? ''} to={f.priceMax?.toString() ?? ''}
            onApply={(pmin, pmax) => { applyTyped({ pmin, pmax }); done(); }}
            onReset={() => { update({ priceMin: undefined, priceMax: undefined }); done(); }}
          />
        )}
      </FilterPopover>

      {showOperators && (
        <FilterPopover
          {...popover('operators')}
          label={pillLabel('filter.operators', selectedOperators.length > 0 ? selectedOperators.map(operatorNameOf).join(separator) : null)}
          title={t('filter.operators')}
          on={selectedOperators.length > 0}
        >
          {() => (
            <ul className={styles.checks}>
              {operators.map(op => (
                <li key={op.id}>
                  <label className={styles.check}>
                    <input type="checkbox" checked={selectedOperators.includes(op.id)} onChange={() => toggleOperator(op.id)} />
                    <span
                      data-dot=""
                      className={styles.dot}
                      style={operatorTagStyle(op.color).style}
                    />
                    {operatorName(op, t.locale)}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </FilterPopover>
      )}

      {showExclude && (
        <FilterPopover
          {...popover('exclude')}
          label={t('filter.label', { name: t('filter.exclude'), value: excluded.length > 0 ? excluded.map(countryName).join(separator) : t('filter.none') })}
          title={t('filter.exclude')}
          on={excluded.length > 0}
          wide
        >
          {() => groupCountries(places.data.countries.filter(c => !HIDDEN_COUNTRY_IDS.includes(c.id))).map(g => (
            // Grouped by part of the world, as in the destination panel.
            <div key={g.id} role="group" aria-labelledby={`${groupIdPrefix}-${g.id}`} className={styles.countryGroup}>
              <div id={`${groupIdPrefix}-${g.id}`} className={styles.groupLabel}>{t(`countryGroup.${g.id}`)}</div>
              <ul className={`${styles.checks} ${styles.countries}`}>
                {g.countries.map(c => (
                  <li key={c.id}>
                    <label className={styles.check}>
                      <input type="checkbox" checked={excluded.includes(c.id)} onChange={() => toggleExcluded(c.id)} />
                      {placeName(c, t.locale)}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </FilterPopover>
      )}

      <FilterPopover
        {...popover('sort')}
        label={pillLabel('filter.sort', t(`sort.${state.sort}`))}
        title={t('filter.sort')}
        on={state.sort !== DEFAULT_SORT}
        sort
        shortLabel={t(`sort.short.${state.sort}`)}
        // Wide enough for a row name and two directions side by side ('Departure date  Soonest first  Latest first').
        wide
      >
        {done => (
          <ul className={styles.sortRows}>
            {SORT_ROWS.map(row => (
              <li key={row.by} className={styles.sortRow}>
                <span data-sort-name="" className={styles.sortName}>{t(`sort.by.${row.by}`)}</span>
                {row.keys.map(key => (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.chip} ${styles.sortDir}`}
                    // The short visible text ('高→低') is part of the full name ('價錢 高→低').
                    aria-label={t(`sort.${key}`)}
                    aria-pressed={state.sort === key}
                    onClick={() => { onChange({ ...state, sort: key, page: 1 }); done(); }}
                  >
                    {t(`sort.dir.${key}`)}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        )}
      </FilterPopover>

      {/* Phones only: the number of tours found, at the bar's right end. */}
      {/* It gives way to the sort control: on a line of its own, out of sight, when both do not fit (CSS). */}
      {total !== undefined && (
        <span className={styles.countBox}><span className={styles.count}>{t('filter.count', { n: formatCount(total) })}</span></span>
      )}
    </div>
    <FilterSheet
      control={sheet} state={state} operators={operators} places={places} t={t} today={today}
      sections={sections} seasons={seasons} fixedDates={fixedDates} clearHref={clearHref} hydrated={hydrated} barId={BAR_ID}
    />
    </>
  );
}

/** Three lines, shorter each time (a funnel), in the button's text colour. */
function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" className={styles.sheetIcon}>
      <path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The fixed language notice (components/LanguageNotice, every language but Traditional Chinese) covers the window's
 * top, so on phones the bar sticks just below it: its height (read from its unseen copy in the page, again whenever
 * it changes) goes on the page's root as --notice-h, with data-notice-measured. Until then (and without JavaScript)
 * the bar does not stick on those pages; Traditional Chinese has no notice, and its bar sticks at the very top.
 */
function useStickBelowNotice() {
  useEffect(() => {
    const spacer = document.querySelector<HTMLElement>('[data-notice-spacer]');
    if (!spacer) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty('--notice-h', `${spacer.offsetHeight}px`);
    measure();
    root.setAttribute('data-notice-measured', '');
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(spacer);
    return () => {
      observer?.disconnect();
      root.style.removeProperty('--notice-h');
      root.removeAttribute('data-notice-measured');
    };
  }, []);
}

interface RangeFormProps {
  type: 'number' | 'date'; t: T;
  from: string; to: string;
  bounds?: { min: number; max: number };
  /** A short note above the inputs on what the range means. */
  hint?: string;
  onApply: (from: string, to: string) => void;
  onReset: () => void;
}

/** Two inputs (由 / 至) with 清除 and 套用. Nothing is applied while typing; Enter or 套用 applies both. */
function RangeForm({ type, t, from, to, bounds, hint, onApply, onReset }: RangeFormProps) {
  const [a, setA] = useState(from);
  const [b, setB] = useState(to);
  const hintId = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onApply(a.trim(), b.trim());
  };
  const numberProps = type === 'number' ? { min: bounds?.min, max: bounds?.max, step: 1, inputMode: 'numeric' as const } : {};
  // Focus lands on the first input when the popover opens, so the note is tied to both inputs to be read out.
  const inputProps = { className: styles.input, type, 'aria-describedby': hint ? hintId : undefined, ...numberProps };
  return (
    <form className={styles.range} onSubmit={submit}>
      {hint && <p id={hintId} className={styles.hint}>{hint}</p>}
      <label className={styles.field}>
        <span>{t('filter.from')}</span>
        <input {...inputProps} value={a} onChange={e => setA(e.target.value)} />
      </label>
      <label className={styles.field}>
        <span>{t('filter.to')}</span>
        <input {...inputProps} value={b} onChange={e => setB(e.target.value)} />
      </label>
      <div className={styles.actions}>
        <button type="button" className={styles.reset} onClick={onReset}>{t('filter.reset')}</button>
        <button type="submit" className={styles.apply}>{t('filter.apply')}</button>
      </div>
    </form>
  );
}
