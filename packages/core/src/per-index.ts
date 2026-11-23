import { normaliseName, type PlacesIndex } from './places/index';

// Lists the route rules read for every tour, built once per places index instead of once per call (task 62). Not part
// of the package's exports.

/**
 * `build`, run once per index and remembered while the index lives. An index's data does not change once built
 * (buildPlacesIndex reads it into its maps then), so the result stays right; an index made by spreading another one
 * with other data (as tests do) is a new object, with its own result.
 */
export function perIndex<T>(build: (index: PlacesIndex) => T): (index: PlacesIndex) => T {
  const cache = new WeakMap<PlacesIndex, T>();
  return index => {
    if (cache.has(index)) return cache.get(index)!;
    const value = build(index);
    cache.set(index, value);
    return value;
  };
}

/** One city and its own names (nameZh and aliases, not the Simplified forms of matchNames), normalised. */
export interface CityNameKeys { id: string; keys: string[] }

/**
 * Every city in data order, with the normalised forms of its nameZh and aliases that are at least 2 characters long,
 * in order (repeats kept). Shared by the stated-point rules (normalise.ts citiesNamedBy, start-point.ts namesAwayCity).
 */
export const cityNameKeys = perIndex((index): readonly CityNameKeys[] => index.data.cities.map(city => ({
  id: city.id,
  keys: [city.nameZh, ...city.aliases].map(normaliseName).filter(key => [...key].length >= 2),
})));
