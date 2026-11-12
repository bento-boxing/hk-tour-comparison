import type { Stop } from './types';

/** regionId null means "all regions of the country". */
export interface Destination { countryId: string; regionId: string | null }

/** True when any stop, not only the first, lies in the destination. */
export function tourMatchesDestination(stops: Stop[], dest: Destination): boolean {
  return stops.some(s => s.countryId === dest.countryId && (dest.regionId === null || s.regionId === dest.regionId));
}

export function tourVisitsCountry(stops: Stop[], countryId: string): boolean {
  return stops.some(s => s.countryId === countryId);
}

/** Distinct `country · region` pairs in route order, for the card's corner label. */
export function tourRegions(stops: Stop[]): Destination[] {
  const seen = new Set<string>();
  const regions: Destination[] = [];
  for (const { countryId, regionId } of stops) {
    const key = `${countryId}:${regionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    regions.push({ countryId, regionId });
  }
  return regions;
}
