'use client';

import { useRouter } from 'next/navigation';
import { places, type Destination, type IsoDate } from '@hktours/core';
import type { OperatorInfo } from '@hktours/db/read';
import type { TourRow } from '../lib/tour-row';
import { useT } from '../lib/i18n-client';
import { localeHref } from '../lib/locale-path';
import { restRange, type ResolvedLeg } from '../lib/chain';
import {
  chainPageHref, withDestination, withGap, withLegAdded, withoutLastLeg, withSearch, type ChainAddress,
} from '../lib/chain-href';
import { markTripAction } from '../lib/remembered-trip';
import { requestTripFocus } from '../lib/trip-undo';
import { ChainStrip } from './ChainStrip';
import { DestinationPanels } from './DestinationPanels';
import { DestinationSearch } from './DestinationSearch';
import { FilterBar } from './FilterBar';
import { Results } from './Results';
import styles from './ChainConnected.module.css';

// The server page cannot pass t or callbacks (functions) to client components, so these wrappers take
// plain data (the validated address, the resolved legs) and record every change in the address; the page
// then renders the new chain and list. Every address comes from lib/chain-href, never from the raw query, in the
// page's language (localeHref).

/** Navigates, in the page's language, without jumping to the top, so the strip and the bar stay where they are. */
function useGoTo(): (address: ChainAddress) => void {
  const router = useRouter();
  const { locale } = useT();
  return address => router.push(localeHref(locale, chainPageHref(address)), { scroll: false });
}

/** The strip, where changing the gap or removing the last leg changes the address (page reset to 1). */
export function ChainStripConnected({ address, legs, departWindow, operators, today }: {
  address: ChainAddress; legs: ResolvedLeg[]; departWindow: { from: IsoDate; to: IsoDate } | null;
  operators: OperatorInfo[]; today: IsoDate;
}) {
  const t = useT();
  const goTo = useGoTo();
  return (
    <ChainStrip
      legs={legs} operators={operators} places={places} today={today} t={t}
      gap={address.chain.gap} departWindow={departWindow}
      // The visitor's own changes to the trip: the trip they lead to is remembered (lib/remembered-trip).
      onGapChange={gap => { markTripAction(); goTo(withGap(address, gap)); }}
      onRemoveLast={() => { markTripAction(); goTo(withoutLastLeg(address)); }}
    />
  );
}

// The chain page's own destination pickers. DestinationConnected's wrappers rebuild the address from the raw
// query, which would bring back dropped legs, a broken gap and junk parameters; these build it from the
// validated address instead, like every other change on this page.

/** The search box for the next leg's destination. */
export function ChainDestinationSearchConnected({ address }: { address: ChainAddress }) {
  const t = useT();
  const goTo = useGoTo();
  const select = (dest: Destination | null) => goTo(withDestination(address, dest));
  return <DestinationSearch places={places} t={t} value={address.search.filters.destination ?? null} onSelect={select} />;
}

/** The 按國家選擇 panels for the next leg's destination. */
export function ChainDestinationPanelsConnected({ address }: { address: ChainAddress }) {
  const t = useT();
  const goTo = useGoTo();
  const select = (dest: Destination) => goTo(withDestination(address, dest));
  return <DestinationPanels places={places} t={t} value={address.search.filters.destination ?? null} onSelect={select} />;
}

/** The next-leg list's filter bar: no date pill (the gap sets the window), plus the exclusion pill. Legs and gap stay. */
export function ChainFilterBarConnected({ address, operators, today }: { address: ChainAddress; operators: OperatorInfo[]; today: IsoDate }) {
  const t = useT();
  const goTo = useGoTo();
  return (
    <FilterBar
      state={address.search} operators={operators} places={places} t={t} today={today}
      show={{ dates: false, exclude: true }}
      onChange={next => goTo(withSearch(address, next))}
    />
  );
}

/**
 * The tours that can come next. Each card says how much rest comes before it; picking a date appends that
 * leg (gap and filters kept, page reset) and goes to the new address, scrolled to the top to show the strip.
 */
export function ChainResultsConnected({ address, lastEndDate, tours, total, operators, today, now }: {
  address: ChainAddress;
  /** The trip's last day; none when choosing the first tour (then no card says how much rest comes before it). */
  lastEndDate?: IsoDate;
  tours: TourRow[]; total: number; operators: OperatorInfo[]; today: IsoDate;
  /** The server's time of this render (ISO), for the rows' old-data warning. */
  now?: string;
}) {
  const t = useT();
  const router = useRouter();
  const footNote = (tour: TourRow) => {
    if (lastEndDate === undefined) return undefined;
    const rest = restRange(lastEndDate, tour.departures.map(d => d.date));
    if (rest === null) return undefined;
    return rest.min === rest.max ? t('chain.afterRest', { n: rest.min }) : t('chain.afterRestRange', { a: rest.min, b: rest.max });
  };
  const add = (tour: TourRow, departure: IsoDate) => {
    const next = chainPageHref(withLegAdded(address, { tourKey: tour.key, departure }));
    markTripAction(); // the visitor's own change: the trip it leads to is remembered
    if (!address.pick) { router.push(localeHref(t.locale, next)); return; }
    // From a phone's choosing screen, back to the trip with the new tour focused. In place of the choosing screen
    // in the history, so Back from the trip goes where Back from the choosing screen would have.
    requestTripFocus('last');
    router.replace(localeHref(t.locale, next));
  };
  return (
    <Results
      tours={tours} total={total} operators={operators} places={places} today={today} now={now} t={t}
      footNote={footNote}
      phoneAction="add"
      empty={<p className={styles.noNext}>{t(lastEndDate === undefined ? 'search.empty' : 'chain.noNext')}</p>}
      onAdd={add}
    />
  );
}
