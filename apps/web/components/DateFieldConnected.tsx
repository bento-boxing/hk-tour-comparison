'use client';

import { useRouter } from 'next/navigation';
import { places } from '@hktours/core';
import type { BandDates } from '../lib/band-rows';
import { useT } from '../lib/i18n-client';
import { localeHref } from '../lib/locale-path';
import { useSearchHref } from '../lib/search-address';
import type { SearchState } from '../lib/search-params';
import { seasonSearchHref } from '../lib/seasons';
import { DateField } from './DateField';
import { SHEET_ID } from './FilterSheet';

/**
 * The band's 幾時出發？ field on phones (task 78): a festival leaving in its days goes to its season's page, as the
 * band's season box did (seasonSearchHref); any other choice is the page's own address with the new dates
 * (lib/search-address.tsx: on a season's page, other dates leave it for the search page, as there today). ✕ is the
 * server's address with no dates. Without JavaScript the field opens the filter sheet's in-page form.
 */
export function BandDateFieldConnected({ state, dates }: { state: SearchState; dates: BandDates }) {
  const t = useT();
  const router = useRouter();
  const hrefFor = useSearchHref();
  return (
    <DateField
      t={t} places={places} state={state}
      choices={{ value: dates.value, festivals: dates.festivals, months: dates.months, travel: true }}
      onApply={(next, festival) => router.push(localeHref(t.locale, festival ? seasonSearchHref(festival, next) : hrefFor(next)))}
      clearHref={dates.clearPath === null ? undefined : localeHref(t.locale, dates.clearPath)}
      fallbackHref={`#${SHEET_ID}`}
    />
  );
}
