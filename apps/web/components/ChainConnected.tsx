'use client';

import { useRouter } from 'next/navigation';
import { places, type IsoDate } from '@hktours/core';
import type { OperatorInfo, TourCardData } from '@hktours/db/read';
import { useT } from '../lib/i18n-client';
import { restRange, type ResolvedLeg } from '../lib/chain';
import { chainPageHref, withGap, withLegAdded, withoutLastLeg, withSearch, type ChainAddress } from '../lib/chain-href';
import { ChainStrip } from './ChainStrip';
import { FilterBar } from './FilterBar';
import { Results } from './Results';
import styles from './ChainConnected.module.css';

// The server page cannot pass t or callbacks (functions) to client components, so these wrappers take
// plain data (the validated address, the resolved legs) and record every change in the address; the page
// then renders the new chain and list. Every address comes from lib/chain-href, never from the raw query.

/** Navigates without jumping to the top, so the strip and the bar stay where they are. */
function useGoTo(): (address: ChainAddress) => void {
  const router = useRouter();
  return address => router.push(chainPageHref(address), { scroll: false });
}

/** The strip, where changing the gap or removing the last leg changes the address (page reset to 1). */
export function ChainStripConnected({ address, legs, window, operators, today }: {
  address: ChainAddress; legs: ResolvedLeg[]; window: { from: IsoDate; to: IsoDate } | null;
  operators: OperatorInfo[]; today: IsoDate;
}) {
  const t = useT();
  const goTo = useGoTo();
  return (
    <ChainStrip
      legs={legs} operators={operators} places={places} today={today} t={t}
      gap={address.chain.gap} window={window}
      onGapChange={gap => goTo(withGap(address, gap))}
      onRemoveLast={() => goTo(withoutLastLeg(address))}
    />
  );
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
export function ChainResultsConnected({ address, lastEndDate, tours, total, operators, today }: {
  address: ChainAddress; lastEndDate: IsoDate; tours: TourCardData[]; total: number; operators: OperatorInfo[]; today: IsoDate;
}) {
  const t = useT();
  const router = useRouter();
  const footNote = (tour: TourCardData) => {
    const rest = restRange(lastEndDate, tour.departures.map(d => d.date));
    if (rest === null) return undefined;
    return rest.min === rest.max ? t('chain.afterRest', { n: rest.min }) : t('chain.afterRestRange', { a: rest.min, b: rest.max });
  };
  return (
    <Results
      tours={tours} total={total} operators={operators} places={places} today={today} t={t}
      footNote={footNote}
      empty={<p className={styles.noNext}>{t('chain.noNext')}</p>}
      onAdd={(tour, departure) => router.push(chainPageHref(withLegAdded(address, { tourKey: tour.key, departure })))}
    />
  );
}
