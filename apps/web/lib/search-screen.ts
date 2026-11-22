import type { PlacesIndex } from '@hktours/core';
import type { DestinationCounts } from '@hktours/db/read';
import { destinationId, topDestinations } from './destinations';

// The phone search screen (task 73, the owner's drawing Mobile2Search: components/DestinationScreen.tsx): what the
// page tells it besides the places data, which the browser has already. Worked out on the server from the counts the
// page has read, so the screen costs no read of its own.

/** How many destinations 熱門目的地 offers: two rows of four (four rows of two in English). */
export const POPULAR_COUNT = 8;

export interface ScreenData {
  /** 熱門目的地: today's countries with the most tours, site-wide (the band's own order), as destination ids. */
  popular: string[];
  /**
   * Tours by destination id (a country's or a region's) in the page's context: site-wide, or in the chosen season's
   * days (as the band's row of destinations counts them). Null where the page has no such counts (an operator's page:
   * the site's counts are not the operator's), and then the screen shows none.
   */
  tours: Record<string, number> | null;
}

/**
 * The screen's data: the popular destinations from the site-wide counts, and the counts of `scope` (the band's
 * context), or none.
 */
export function screenData(siteCounts: DestinationCounts, scope: DestinationCounts | null, places: PlacesIndex): ScreenData {
  const popular = topDestinations(places, siteCounts, POPULAR_COUNT).map(x => destinationId(x.destination));
  if (scope === null) return { popular, tours: null };
  const tours: Record<string, number> = {};
  for (const line of scope.destinations) {
    const id = line.regionId ?? line.countryId;
    // The first line of a repeat, as countOf reads them.
    if (!Object.hasOwn(tours, id)) tours[id] = line.tours;
  }
  return { popular, tours };
}
