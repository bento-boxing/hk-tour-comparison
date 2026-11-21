'use client';

import { useRouter } from 'next/navigation';
import { places, type Destination } from '@hktours/core';
import { useT } from '../lib/i18n-client';
import { localeHref } from '../lib/locale-path';
import { withFilters, type SearchState } from '../lib/search-params';
import { useSearchHref } from '../lib/search-address';
import { DestinationSearch } from './DestinationSearch';
import { DestinationPanels } from './DestinationPanels';

// Server pages cannot pass functions (t, onSelect) to client components, so these wrappers take the page's
// search state (validated on the server) and record a choice in the address instead.

/**
 * Goes to the chosen destination's page ('/tours/<id>'), or to the search page ('/') when cleared, in the page's
 * language, with the other filters and the sort kept and back on page 1 (searchHref). On an operator's page the
 * choice is a filter of that page instead: it stays there, with the destination in the query (lib/search-address.tsx).
 */
function useSelectDestinationInAddress(state: SearchState): (dest: Destination | null) => void {
  const router = useRouter();
  const { locale } = useT();
  const hrefFor = useSearchHref();
  return dest => router.push(localeHref(locale, hrefFor(withFilters(state, { destination: dest ?? undefined }))));
}

export function DestinationSearchConnected({ state, placeholder }: { state: SearchState; placeholder?: string }) {
  const t = useT();
  const onSelect = useSelectDestinationInAddress(state);
  return <DestinationSearch places={places} t={t} value={state.filters.destination ?? null} onSelect={onSelect} placeholder={placeholder} />;
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
