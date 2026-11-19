'use client';

import { useRouter } from 'next/navigation';
import { places, type Destination } from '@hktours/core';
import { useT } from '../lib/i18n-client';
import { localeHref } from '../lib/locale-path';
import { searchHref, withFilters, type SearchState } from '../lib/search-params';
import { DestinationSearch } from './DestinationSearch';
import { DestinationPanels } from './DestinationPanels';

// Server pages cannot pass functions (t, onSelect) to client components, so these wrappers take the page's
// search state (validated on the server) and record a choice in the address instead.

/**
 * Goes to the chosen destination's page ('/tours/<id>'), or to the search page ('/') when cleared, in the page's
 * language, with the other filters and the sort kept and back on page 1 (searchHref).
 */
function useSelectDestinationInAddress(state: SearchState): (dest: Destination | null) => void {
  const router = useRouter();
  const { locale } = useT();
  return dest => router.push(localeHref(locale, searchHref(withFilters(state, { destination: dest ?? undefined }))));
}

export function DestinationSearchConnected({ state }: { state: SearchState }) {
  const t = useT();
  const onSelect = useSelectDestinationInAddress(state);
  return <DestinationSearch places={places} t={t} value={state.filters.destination ?? null} onSelect={onSelect} />;
}

export function DestinationPanelsConnected({ state, hiddenCountryIds }: { state: SearchState; hiddenCountryIds?: string[] }) {
  const t = useT();
  const onSelect = useSelectDestinationInAddress(state);
  return (
    <DestinationPanels
      places={places} t={t} value={state.filters.destination ?? null} onSelect={onSelect} hiddenCountryIds={hiddenCountryIds}
    />
  );
}
