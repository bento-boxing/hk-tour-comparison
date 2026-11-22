import { groupCountries, type Destination, type PlacesIndex } from '@hktours/core';
import type { T } from './i18n';
import { placeName } from './place-names';

// What the country pickers offer (the wide 按國家選擇 panel, components/DestinationPanels.tsx, and the phone search
// screen's 按地區瀏覽, components/DestinationScreen.tsx): the same countries, regions and rules in both.

/** Country ids never offered by default. */
export const DEFAULT_HIDDEN_COUNTRY_IDS: readonly string[] = ['hongkong'];

/** The countries offered, under their parts of the world (none for a part with no country offered). */
export function offeredCountryGroups(places: PlacesIndex, hiddenCountryIds: readonly string[] = DEFAULT_HIDDEN_COUNTRY_IDS) {
  return groupCountries(places.data.countries.filter(c => !hiddenCountryIds.includes(c.id)));
}

/**
 * A country with one region is chosen at once, as the whole country (which the search box also offers as
 * `<country> → 全部地區`): there is no second step.
 */
export function choosesWholeCountry(places: PlacesIndex, countryId: string): boolean {
  return places.regionsOf(countryId).length === 1;
}

export interface RegionChoice { key: string; label: string; dest: Destination }

/** A country's second step: `全部地區` first, then its regions. */
export function regionChoices(places: PlacesIndex, countryId: string, t: T): RegionChoice[] {
  return [
    { key: '', label: t('dest.allRegions'), dest: { countryId, regionId: null } },
    // An area region (華東, 東北) is not offered (task 40 fix round 1): it finds only tours whose only place it is.
    ...places.regionsOf(countryId).filter(r => r.members === undefined)
      .map(r => ({ key: r.id, label: placeName(r, t.locale), dest: { countryId, regionId: r.id } })),
  ];
}
