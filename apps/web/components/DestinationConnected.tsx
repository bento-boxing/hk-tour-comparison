'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { places, type Destination } from '@hktours/core';
import { useT } from '../lib/i18n-client';
import { DestinationSearch } from './DestinationSearch';
import { DestinationPanels } from './DestinationPanels';

// Server pages cannot pass functions (t, onSelect) to client components, so these wrappers take
// only the current destination and record a choice in the address instead.

/** Sets `dest` (region id, or country id for all regions; removed when null) and drops `page`. */
function useSelectDestinationInAddress(): (dest: Destination | null) => void {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return dest => {
    const next = new URLSearchParams(params.toString());
    if (dest) next.set('dest', dest.regionId ?? dest.countryId);
    else next.delete('dest');
    next.delete('page');
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };
}

export function DestinationSearchConnected({ value }: { value: Destination | null }) {
  return <DestinationSearch places={places} t={useT()} value={value} onSelect={useSelectDestinationInAddress()} />;
}

export function DestinationPanelsConnected({ value, hiddenCountryIds }: { value: Destination | null; hiddenCountryIds?: string[] }) {
  return (
    <DestinationPanels places={places} t={useT()} value={value} onSelect={useSelectDestinationInAddress()} hiddenCountryIds={hiddenCountryIds} />
  );
}
