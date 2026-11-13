import rawData from './data.json';

export interface Country { id: string; nameZh: string; nameEn: string; aliases: string[] }
export interface Region { id: string; countryId: string; nameZh: string; nameEn: string; aliases: string[] }
export interface City { id: string; regionId: string; nameZh: string; nameEn: string; aliases: string[] }
export interface PlacesData {
  countries: Country[]; regions: Region[]; cities: City[];
  /** Names that contain a city name but are not that city, e.g. 松山湖 (Dongguan), which contains 松山. */
  notPlaces?: string[];
}

export interface PlacesIndex {
  data: PlacesData;
  country(id: string): Country | undefined;
  region(id: string): Region | undefined;
  city(id: string): City | undefined;
  regionsOf(countryId: string): Region[];
  citiesOf(regionId: string): City[];
  /** Exact match on nameZh or an alias, after normaliseName. */
  findCity(name: string): City[];
  findRegion(name: string): Region[];
  findCountry(name: string): Country[];
}

/** Trims, removes all whitespace (including full-width spaces), turns 臺 into 台 and lower-cases Latin letters. */
export function normaliseName(s: string): string {
  return s.replace(/\s+/g, '').replace(/臺/g, '台').toLowerCase();
}

type Named = { nameZh: string; aliases: string[] };

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map(item => [item.id, item]));
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

/** Maps every normalised nameZh and alias to the entries carrying it, each entry at most once per name. */
function byName<T extends Named>(items: T[]): Map<string, T[]> {
  const names = new Map<string, T[]>();
  for (const item of items) {
    for (const name of [item.nameZh, ...item.aliases]) {
      const key = normaliseName(name);
      if (key === '') continue;
      const matches = names.get(key);
      if (!matches) names.set(key, [item]);
      else if (!matches.includes(item)) matches.push(item);
    }
  }
  return names;
}

export function buildPlacesIndex(data: PlacesData): PlacesIndex {
  const countries = byId(data.countries);
  const regions = byId(data.regions);
  const cities = byId(data.cities);
  const regionsByCountry = groupBy(data.regions, r => r.countryId);
  const citiesByRegion = groupBy(data.cities, c => c.regionId);
  const countryNames = byName(data.countries);
  const regionNames = byName(data.regions);
  const cityNames = byName(data.cities);
  const find = <T>(names: Map<string, T[]>, name: string): T[] => [...(names.get(normaliseName(name)) ?? [])];

  return {
    data,
    country: id => countries.get(id),
    region: id => regions.get(id),
    city: id => cities.get(id),
    regionsOf: countryId => [...(regionsByCountry.get(countryId) ?? [])],
    citiesOf: regionId => [...(citiesByRegion.get(regionId) ?? [])],
    findCity: name => find(cityNames, name),
    findRegion: name => find(regionNames, name),
    findCountry: name => find(countryNames, name),
  };
}

export const places: PlacesIndex = buildPlacesIndex(rawData as PlacesData);
