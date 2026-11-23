'use client';

import { Fragment, useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { places, type ChainState, type IsoDate } from '@hktours/core';
import type { OperatorInfo } from '@hktours/db/read';
import type { T } from '../lib/i18n';
import { useT } from '../lib/i18n-client';
import { localeHref } from '../lib/locale-path';
import { chainTotals, type ResolvedLeg } from '../lib/chain';
import {
  chainHref, chainPageHref, pickScreen, tripScreen, withGap, withoutFirstLeg, withoutLastLeg, withoutLegs, type ChainAddress,
} from '../lib/chain-href';
import { departureDateText, routeNames } from '../lib/card-text';
import { operatorTagStyle } from '../lib/contrast';
import { chipDay, formatChipDate, formatLength, formatPrice } from '../lib/format';
import { operatorName } from '../lib/place-names';
import { recordOpened } from '../lib/opened-tours';
import { useOperatorLinkTarget } from '../lib/link-target';
import { useRouteDisclosure } from '../lib/open-routes';
import {
  getRememberedTrip, isHistoryTraversal, markTripAction, peekTripAction, rememberTrip, takeTripAction, tripToRemember, useTripMemory,
} from '../lib/remembered-trip';
import { getTripUndo, requestTripFocus, setTripUndo, takeTripFocus, useTripUndo, type TripUndo } from '../lib/trip-undo';
import { usePopoverDismiss } from '../lib/use-popover-dismiss';
import { GapSelector } from './GapSelector';
import { PriceWithFrom } from './PriceWithFrom';
import { SiteLink } from './SiteLink';
import { useRouteCut } from './TourCard';
import styles from './TripPhone.module.css';

// The trip page on a phone (under 1024px; task 71, the owner's drawings Mobile16Trip, Mobile20TripLong and
// Mobile17Pick): the trip as numbered steps with its gold total, and the screen for choosing the next tour (`pick=1`
// in the address). From 1024px none of this is drawn (CSS): the wide page keeps its strip. Every address comes from
// lib/chain-href, from the validated one, in the page's language, as on the rest of the page.

/** Navigates to a path (without a language: lib/chain-href's) in the page's language, without jumping to the top. */
function useGoTo(): (path: string) => void {
  const router = useRouter();
  const { locale } = useT();
  return path => router.push(localeHref(locale, path), { scroll: false });
}

/** '12/19 (六)': a day of the trip with its weekday, with the year when it is not this year's. */
function dayText(date: IsoDate, today: IsoDate, t: T): string {
  return `${formatChipDate(date, today, t)} ${chipDay(date, t).weekday}`;
}

/**
 * The total (both the trip and the choosing screen): the label, the tours and the days from the first departure to
 * the last return, rest included, then the sum of the prices. Each part keeps to one line; on a screen too
 * narrow for both (very large text), the price goes under rather than out of the strip.
 */
function TripTotal({ legs, label }: { legs: ResolvedLeg[]; label: string }) {
  const t = useT();
  const totals = chainTotals(legs);
  return (
    <div className={styles.total} data-total="">
      <span className={styles.totalCount}>
        <span className={styles.totalLabel}>{label}</span>{' '}
        {t('chain.totalCount', { n: legs.length, d: totals.spanDays })}
      </span>
      <b className={styles.totalPrice}>
        {/* Marked 起 as the wide strip's total is: when a tour's departure has no price of its own. */}
        {totals.priceIsExact ? formatPrice(totals.priceHkd) : <PriceWithFrom price={formatPrice(totals.priceHkd)} t={t} fromClassName={styles.from} />}
      </b>
    </div>
  );
}

/**
 * Keeps this browser's copy of the trip (lib/remembered-trip) as the rule there says: the trip shown is remembered
 * (an empty one forgets it) only when the visitor's own action led here, or when it is the remembered trip itself
 * (whose dropped tours are then pruned). The bare '/chain' (the header's and bottom bar's link before the page's
 * scripts run, or typed) asks for the remembered trip instead: if there is one, the page is replaced by it (a client
 * redirect; replace, so Back does not return to the bare address), except when history brought the visitor here.
 */
export function TripMemory({ chain, requested, bare }: { chain: ChainState; requested: ChainState; bare: boolean }) {
  const router = useRouter();
  const { locale } = useT();
  const here = chainHref(chain);
  const asked = chainHref(requested);
  useEffect(() => {
    const acted = takeTripAction();
    if (bare) {
      const trip = getRememberedTrip();
      if (trip && !isHistoryTraversal()) router.replace(localeHref(locale, trip.path));
      return;
    }
    if (tripToRemember(chain, requested, getRememberedTrip(), acted)) rememberTrip(chain);
    // `here` and `asked` stand for `chain` and `requested`, which are new objects on every render.
  }, [bare, here, asked, locale, router]);
  return null;
}

/** 清空 at the top right of the trip (phones only): forgets the trip, with an undo. */
export function TripClear({ address }: { address: ChainAddress }) {
  const t = useT();
  const goTo = useGoTo();
  const clear = () => {
    const from = chainPageHref(address);
    const to = chainPageHref(withoutLegs(address));
    setTripUndo({ what: 'all', from, to });
    requestTripFocus('undo');
    markTripAction();
    goTo(to);
  };
  return (
    <button type="button" className={styles.clear} aria-label={t('trip.clearName')} onClick={clear}>
      {t('trip.clear')}
    </button>
  );
}

/** One tour of the trip: its tag, days and price; its route (two lines, then 全部 N 站); its dates; maybe its ×. */
function TourStep({ leg, operator, today, removable, onRemove }: {
  leg: ResolvedLeg; operator: OperatorInfo | undefined; today: IsoDate; removable: boolean; onRemove: (label: string) => void;
}) {
  const t = useT();
  const routeRef = useRef<HTMLParagraphElement>(null);
  const cut = useRouteCut(routeRef);
  const { tour } = leg;
  // 全部 N 站 reopens on coming back with Back (lib/open-routes); the operator's page opens in this tab (lib/link-target).
  const allStops = useRouteDisclosure(`trip:${tour.key}@${leg.departure}`);
  const linkTarget = useOperatorLinkTarget();
  const route = routeNames(tour.stops, places, t.locale);
  const operatorText = operator ? operatorName(operator, t.locale) : tour.operatorId;
  const { style, dark } = operatorTagStyle(operator?.color);
  const price = formatPrice(leg.priceHkd);
  const priceText = leg.priceIsExact ? price : t('card.priceFrom', { price });
  const dates = `${dayText(leg.departure, today, t)} – ${dayText(leg.endDate, today, t)}`;
  const longDates = t('date.range', {
    from: departureDateText(leg.departure, t) ?? leg.departure, to: departureDateText(leg.endDate, t) ?? leg.endDate,
  });
  const separator = t('dest.listSeparator');
  const name = t('trip.tourName', { operator: operatorText, route: route.join(separator), dates: longDates, price: priceText });
  const label = t('save.tour', { operator: operatorText, route: route.join(separator), length: formatLength(tour.days, tour.nights, t) });
  const linkable = /^https:\/\//i.test(tour.url);
  const noteOpened = (e: MouseEvent) => { if (e.button <= 1) recordOpened(tour.key); };

  // Without a link (an address that is not https), the tour itself takes the focus a press asks for.
  const focusTarget = linkable ? {} : { tabIndex: -1, 'aria-label': name, role: 'group', 'data-focus-tour': '' };
  return (
    <div className={styles.tour} style={style} {...focusTarget}>
      <div className={styles.line1}>
        <span className={dark ? `${styles.op} ${styles.opDark}` : styles.op}>{operatorText}</span>
        <span className={styles.days}>{formatLength(tour.days, null, t)}</span>
        <span className={styles.price}>{leg.priceIsExact ? price : <PriceWithFrom price={price} t={t} fromClassName={styles.from} />}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.text}>
          <div className={styles.routeBox}>
            <p ref={routeRef} className={styles.route}>{route.join(' → ')}</p>
            {route.length > 1 && (
              <details className={styles.allStops} hidden={cut === false} {...allStops}>
                <summary className={styles.allStopsToggle}>
                  {t('card.allStops', { n: route.length })}
                  <span aria-hidden="true" className={styles.caret} />
                </summary>
              </details>
            )}
          </div>
          <p className={styles.dates}>{dates}</p>
        </div>
        {removable && (
          <button type="button" className={styles.remove} aria-label={t('trip.remove', { tour: label })} onClick={() => onRemove(label)}>
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
      {/* Over the whole tour (CSS), named by it: a press anywhere on the tour opens the operator's page. */}
      {linkable && (
        <a
          href={tour.url} target={linkTarget} rel="noopener noreferrer" className={styles.open} aria-label={name}
          data-focus-tour="" onClick={noteOpened} onAuxClick={noteOpened}
        />
      )}
    </div>
  );
}

/**
 * The trip as numbered steps joined by a line (phones only): each tour; between two tours the real rest between them;
 * then the dashed button to choose the next tour (or, on an empty trip, the first), unless the trip is full. Then the
 * gold total and the small print. The first and the last tour each have a × (one × for a single tour); after a removal
 * (or 清空) a message offers to undo it, until the trip changes again.
 */
export function TripSteps({ address, requested, legs, departWindow, operators, today }: {
  address: ChainAddress; requested: ChainState; legs: ResolvedLeg[]; departWindow: { from: IsoDate; to: IsoDate } | null;
  operators: OperatorInfo[]; today: IsoDate;
}) {
  const t = useT();
  const goTo = useGoTo();
  const undo = useTripUndo();
  const listRef = useRef<HTMLOListElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const here = chainPageHref(address);
  const shown = undo && undo.to === here ? undo : null;
  const byId = new Map(operators.map(o => [o.id, o]));
  const full = legs.length > 0 && !departWindow;
  // A trip that is not the one remembered (a link someone shared, an older state reached with Back): shown as asked,
  // with one line offering to use it. Not while the visitor's own action is about to be remembered (TripMemory).
  const memory = useTripMemory();
  const other = memory.hydrated && legs.length > 0 && !peekTripAction() && !tripToRemember(address.chain, requested, memory.trip, false);
  const adopt = () => {
    rememberTrip(address.chain);
    listRef.current?.querySelector<HTMLElement>('[data-focus-tour]')?.focus();
  };

  // A removal is offered for undoing on the address it led to only: arriving anywhere else ends the offer. (Read when
  // the address changes, not when the offer does: the press that makes it is made here, on the address it leaves.)
  useEffect(() => {
    const offered = getTripUndo();
    if (offered && offered.to !== here) setTripUndo(null);
  }, [here]);

  // Where the press that led here asked focus to go.
  useEffect(() => {
    const target = takeTripFocus(['first', 'last', 'add', 'undo']);
    const list = listRef.current;
    if (!target || !list) return;
    const tours = list.querySelectorAll<HTMLElement>('[data-focus-tour]');
    const add = list.querySelector<HTMLElement>('[data-focus-add]');
    const element = target === 'undo' ? undoRef.current ?? add
      : target === 'first' ? tours[0] ?? add
        : target === 'last' ? tours[tours.length - 1] ?? add
          : add ?? tours[tours.length - 1];
    element?.focus();
  }, [here]);

  const remove = (what: 'first' | 'last', label: string) => {
    const to = chainPageHref(what === 'first' ? withoutFirstLeg(address) : withoutLastLeg(address));
    setTripUndo({ what, label, from: here, to });
    requestTripFocus('undo');
    markTripAction();
    goTo(to);
  };
  const restore = (removed: TripUndo) => {
    setTripUndo(null);
    requestTripFocus(removed.what === 'last' ? 'last' : 'first');
    markTripAction();
    goTo(removed.from);
  };

  let step = 0;
  return (
    <div className={styles.trip}>
      {/* Announced when a removal brings it; its button takes focus. */}
      <div role="status" className={styles.undoArea} data-undo="">
        {shown && (
          <p className={styles.undo}>
            {t(shown.what === 'all' ? 'trip.cleared' : 'trip.removed')}
            {shown.label && <span className={styles.visuallyHidden}>{` ${shown.label}`}</span>}
            <span aria-hidden="true">·</span>
            <button ref={undoRef} type="button" className={styles.undoButton} onClick={() => restore(shown)}>{t('trip.undo')}</button>
          </p>
        )}
      </div>
      {other && (
        <p className={styles.other}>
          {t(memory.trip ? 'trip.notYours' : 'trip.notSaved')}
          <span aria-hidden="true">·</span>
          <button type="button" className={styles.adopt} onClick={adopt}>{t('trip.adopt')}</button>
        </p>
      )}

      <ol ref={listRef} className={styles.steps} role="list">
        {legs.map((leg, i) => (
          <Fragment key={`${leg.tour.key}@${leg.departure}`}>
            {leg.gapBefore !== null && (
              <li className={styles.step}>
                <span className={styles.num} aria-hidden="true">{++step}</span>
                <span className={styles.rest}>
                  {leg.gapBefore === 0 ? t('trip.restNone') : t('chain.restDays', { n: leg.gapBefore })}
                </span>
              </li>
            )}
            <li className={styles.step}>
              <span className={styles.num} aria-hidden="true">{++step}</span>
              <TourStep
                leg={leg} operator={byId.get(leg.tour.operatorId)} today={today}
                removable={i === 0 || i === legs.length - 1}
                onRemove={label => remove(i === 0 ? 'first' : 'last', label)}
              />
            </li>
          </Fragment>
        ))}
        {!full && (
          <li className={`${styles.step} ${styles.addStep}`}>
            <span className={`${styles.num} ${styles.numNext}`} aria-hidden="true">{++step}</span>
            <SiteLink href={localeHref(t.locale, chainPageHref(pickScreen(address)))} className={styles.add} data-focus-add="" onClick={() => requestTripFocus('pick')}>
              <span className={styles.addText}>
                <span className={styles.addTitle}>
                  <span aria-hidden="true">{t.locale === 'en' ? '+ ' : '＋ '}</span>
                  {t(legs.length > 0 ? 'trip.addNext' : 'trip.addFirst')}
                </span>
                {' '}
                <span className={styles.addSub}>
                  {departWindow
                    ? t('trip.addWindow', { from: formatChipDate(departWindow.from, today, t), to: formatChipDate(departWindow.to, today, t) })
                    : t('trip.firstHint')}
                </span>
              </span>
              <span className={styles.chevron} aria-hidden="true">›</span>
            </SiteLink>
          </li>
        )}
      </ol>

      {legs.length > 0 && (
        <>
          <TripTotal legs={legs} label={t('trip.total')} />
          <p className={styles.smallPrint}>{t('trip.smallPrint')}</p>
        </>
      )}
    </div>
  );
}

/**
 * The rest before the next tour as one control (休息 1 至 3 日 ▾): it opens a small popover with the two existing
 * fields (GapSelector). What they show is applied when the popover closes with 完成, the control again or a press
 * outside it (the list then reloads, still on the choosing screen); Escape closes it and changes nothing. Focus returns
 * to the control. The fields are read as they stand when it closes, not as their last blur left them: a press on a
 * button does not move focus in every browser (Safari), so the field being typed in may never be left.
 */
function RestControl({ address }: { address: ChainAddress }) {
  const t = useT();
  const goTo = useGoTo();
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const { gap } = address.chain;
  const here = chainPageHref(address);

  /** The two fields as they stand (an emptied one keeps its value); the address cleans the result (withGap). */
  const typed = () => {
    const [min, max] = [...(panelRef.current?.querySelectorAll('input') ?? [])].map(input => input.value);
    const read = (text: string | undefined, fallback: number) => (text && /^\d+$/.test(text) ? Number(text) : fallback);
    return { min: read(min, gap.min), max: read(max, gap.max) };
  };
  const close = (apply: boolean, returnFocus: boolean) => {
    const next = apply ? withGap(address, typed()) : address;
    setOpen(false);
    if (next.chain.gap.min !== gap.min || next.chain.gap.max !== gap.max) {
      requestTripFocus('rest');
      markTripAction();
      goTo(chainPageHref(next));
    }
    if (returnFocus) chipRef.current?.focus({ preventScroll: true });
  };
  const dismiss = usePopoverDismiss(panelRef, reason => close(reason === 'outside', reason === 'escape'), chipRef);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [open]);
  useEffect(() => {
    if (takeTripFocus(['rest'])) chipRef.current?.focus({ preventScroll: true });
  }, [here]);

  return (
    <div className={styles.restControl}>
      <button
        ref={chipRef} type="button" className={styles.restChip} aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => (open ? close(true, true) : setOpen(true))}
      >
        {gap.min === gap.max ? t('chain.restDays', { n: gap.min }) : t('trip.restChip', { min: gap.min, max: gap.max })}
        <span aria-hidden="true" className={styles.caret} />
      </button>
      {open && (
        <div id={id} ref={panelRef} className={styles.restPanel} onKeyDown={dismiss}>
          {/* Its own onChange (on leaving a field) only keeps the two fields in order here: closing applies them. */}
          <GapSelector gap={gap} t={t} onChange={() => {}} />
          <button type="button" className={styles.restDone} onClick={() => close(true, true)}>{t('trip.restDone')}</button>
        </div>
      )}
    </div>
  );
}

/**
 * The top of the screen for choosing a tour (phones only; `pick=1`): a bar with ← (back to the trip) and 選擇第 N 個旅行團,
 * the gold strip with the trip so far, and the dates the next tour may leave with the rest control. The page puts the
 * search box, the filters and the tours that fit under it.
 */
export function TripPickHead({ address, legs, departWindow, today }: {
  address: ChainAddress; legs: ResolvedLeg[]; departWindow: { from: IsoDate; to: IsoDate } | null; today: IsoDate;
}) {
  const t = useT();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const here = chainPageHref(address);
  useEffect(() => {
    if (takeTripFocus(['pick'])) headingRef.current?.focus({ preventScroll: true });
  }, [here]);
  return (
    <div className={styles.pick}>
      <div className={styles.pickBar}>
        <SiteLink href={localeHref(t.locale, chainPageHref(tripScreen(address)))} className={styles.back} aria-label={t('trip.back')} onClick={() => requestTripFocus('add')}>
          <span aria-hidden="true">←</span>
        </SiteLink>
        <h2 id="pick-heading" ref={headingRef} tabIndex={-1} className={styles.pickTitle}>{t('trip.pickTitle', { n: legs.length + 1 })}</h2>
      </div>
      {legs.length > 0 && <TripTotal legs={legs} label={t('chain.yours')} />}
      {departWindow && (
        <div className={styles.windowRow}>
          <span className={styles.window}>
            {t('trip.window', { from: formatChipDate(departWindow.from, today, t), to: formatChipDate(departWindow.to, today, t) })}
          </span>
          <RestControl address={address} />
        </div>
      )}
    </div>
  );
}
