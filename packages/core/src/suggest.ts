import { normaliseName } from './places/index';
import type { City, Country, PlacesIndex, Region } from './places/index';
import type { Destination } from './destination';

export interface Suggestion {
  destination: Destination;
  label: string;            // '日本 → 關西' or '日本 → 全部地區'
  via: string | null;       // the city name that matched, e.g. '大阪'; null for region/country matches
}

export const ALL_REGIONS_LABEL = '全部地區';

type Place = { nameZh: string; nameEn: string; aliases: string[] };
type NameTest = (name: string) => boolean;

/** Every normalised name a place answers to: Chinese, English and aliases. */
const namesOf = (p: Place) => [p.nameZh, p.nameEn, ...p.aliases].map(normaliseName).filter(n => n !== '');

function matching<T extends Place>(items: T[], test: NameTest): T[] {
  return items.filter(p => namesOf(p).some(test));
}

/**
 * Turns a search-bar query into `Country → Region` suggestions, best matches first:
 * exact city, region, country; then prefix city, region, country; then substring city, region.
 * Chinese names, aliases and English names all match; labels are always Chinese.
 */
export function suggestRegions(query: string, index: PlacesIndex, limit = 8): Suggestion[] {
  const q = normaliseName(query);
  if (q === '') return [];

  const results: Suggestion[] = [];
  const seen = new Set<string>();
  const add = (s: Suggestion) => {
    const key = `${s.destination.countryId}:${s.destination.regionId ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(s);
  };
  const addRegion = (region: Region | undefined, via: string | null = null) => {
    const country = region && index.country(region.countryId);
    if (!region || !country) return;
    add({ destination: { countryId: country.id, regionId: region.id }, label: `${country.nameZh} → ${region.nameZh}`, via });
  };
  const addCity = (city: City) => addRegion(index.region(city.regionId), city.nameZh);
  const addAllRegions = (country: Country) =>
    add({ destination: { countryId: country.id, regionId: null }, label: `${country.nameZh} → ${ALL_REGIONS_LABEL}`, via: null });

  const { countries, regions, cities } = index.data;
  const equals: NameTest = n => n === q;
  const startsWith: NameTest = n => n.startsWith(q);
  const contains: NameTest = n => n.includes(q);

  // Every rule matches nameZh, nameEn and aliases.
  // 1–3: exact city, region, country.
  matching(cities, equals).forEach(addCity);
  matching(regions, equals).forEach(r => addRegion(r));
  for (const country of matching(countries, equals)) {
    addAllRegions(country);
    index.regionsOf(country.id).forEach(r => addRegion(r));
  }
  // 4–5: city, region, then country starts with the query.
  matching(cities, startsWith).forEach(addCity);
  matching(regions, startsWith).forEach(r => addRegion(r));
  matching(countries, startsWith).forEach(addAllRegions);
  // 6: city, then region, contains the query.
  matching(cities, contains).forEach(addCity);
  matching(regions, contains).forEach(r => addRegion(r));

  return results.slice(0, limit);
}
