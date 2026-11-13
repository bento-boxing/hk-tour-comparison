'use client';

import { usePathname, useRouter } from 'next/navigation';
import { places, type IsoDate } from '@hktours/core';
import type { OperatorInfo } from '@hktours/db/read';
import { useT } from '../lib/i18n-client';
import { searchHref, type SearchState } from '../lib/search-params';
import { FilterBar } from './FilterBar';

// The server page cannot pass t or onChange (functions) to client components, so this wrapper records
// every change in the address instead; the page then renders the new results.

/** The search page's filter bar: a change navigates to the same page with the new address (page reset to 1). */
export function FilterBarConnected({ state, operators, today }: { state: SearchState; operators: OperatorInfo[]; today: IsoDate }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <FilterBar
      state={state} operators={operators} places={places} t={t} today={today}
      // scroll: false keeps the bar where it is while the list below changes.
      onChange={next => router.push(searchHref(next, pathname), { scroll: false })}
    />
  );
}
