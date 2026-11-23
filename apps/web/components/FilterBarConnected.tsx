'use client';

import { useRouter } from 'next/navigation';
import { places, type IsoDate } from '@hktours/core';
import type { OperatorInfo } from '@hktours/db/read';
import { useT } from '../lib/i18n-client';
import { localeHref } from '../lib/locale-path';
import { useFixedOperator, useFixedSeason, useSearchHref } from '../lib/search-address';
import type { SeasonWindow } from '../lib/seasons';
import type { SearchState } from '../lib/search-params';
import { FilterBar } from './FilterBar';

// The server page cannot pass t or onChange (functions) to client components, so this wrapper records
// every change in the address instead; the page then renders the new results.

/**
 * The search page's filter bar: a change navigates to the page it is on, in its language, with the new address (page
 * reset to 1): the search page or a destination's (searchHref), or an operator's page (lib/search-address.tsx), which
 * offers no operator filter because its path fixes the operator. On phones its bar shows `total` (the tours found) and
 * its sheet offers `seasons` as one-tap departure windows; on a season's page the season's days are the page's own.
 */
export function FilterBarConnected({ state, operators, today, total, seasons, dateField }: {
  state: SearchState; operators: OperatorInfo[]; today: IsoDate; total?: number; seasons?: SeasonWindow[];
  /** The band has the phone's date field (task 78). */
  dateField?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const hrefFor = useSearchHref();
  const fixedOperator = useFixedOperator();
  const fixedSeason = useFixedSeason();
  const addressOf = (next: SearchState) => localeHref(t.locale, hrefFor(next));
  return (
    <FilterBar
      state={state} operators={operators} places={places} t={t} today={today}
      show={fixedOperator === null ? undefined : { operators: false }}
      total={total} seasons={seasons} fixedDates={fixedSeason} hrefFor={addressOf} dateField={dateField}
      // scroll: false keeps the bar where it is while the list below changes.
      onChange={next => router.push(localeHref(t.locale, hrefFor(next)), { scroll: false })}
    />
  );
}
