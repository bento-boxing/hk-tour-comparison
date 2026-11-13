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
 * A country reached by an exact city or region match also gets its 全部地區 row, after its last such row.
 * A country with exactly one region never gets a region row: its single row is 全部地區 (with `via` when a
 * city matched), so 新加坡 reads `新加坡 → 全部地區`, not `新加坡 → 新加坡`.
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
  // A country with one region gets its 全部地區 row instead: the two would find the same tours.
  const addRegion = (region: Region | undefined, via: string | null = null) => {
    const country = region && index.country(region.countryId);
    if (!region || !country) return;
    if (index.regionsOf(country.id).length === 1) return add(allRegionsRow(country, via));
    add({ destination: { countryId: country.id, regionId: region.id }, label: `${country.nameZh} → ${region.nameZh}`, via });
  };
  const addCity = (city: City) => addRegion(index.region(city.regionId), city.nameZh);
  const addAllRegions = (country: Country) => add(allRegionsRow(country));

  const { countries, regions, cities } = index.data;
  const equals: NameTest = n => n === q;
  const startsWith: NameTest = n => n.startsWith(q);
  const contains: NameTest = n => n.includes(q);

  // Every rule matches nameZh, nameEn and aliases.
  // 1–3: exact city, region, country.
  matching(cities, equals).forEach(addCity);
  matching(regions, equals).forEach(r => addRegion(r));
  const exactRegionRows = results.length;
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

  return withAllRegionsAfterExact(results, exactRegionRows, index).slice(0, limit);
}

function allRegionsRow(country: Country, via: string | null = null): Suggestion {
  return { destination: { countryId: country.id, regionId: null }, label: `${country.nameZh} → ${ALL_REGIONS_LABEL}`, via };
}

/**
 * The first `exactRows` results come from exact city or region matches (rules 1–2). For each country among
 * them that has no 全部地區 row anywhere yet, puts one right after that country's last such row.
 */
function withAllRegionsAfterExact(results: Suggestion[], exactRows: number, index: PlacesIndex): Suggestion[] {
  const offered = new Set(results.filter(s => s.destination.regionId === null).map(s => s.destination.countryId));
  const lastExactRow = new Map<string, number>();
  results.slice(0, exactRows).forEach((s, i) => lastExactRow.set(s.destination.countryId, i));
  return results.flatMap((s, i) => {
    const country = index.country(s.destination.countryId);
    if (!country || offered.has(country.id) || lastExactRow.get(country.id) !== i) return [s];
    return [s, allRegionsRow(country)];
  });
}
