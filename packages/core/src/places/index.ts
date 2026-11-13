import rawData from './data.json';

/**
 * The parts of the world the country lists are arranged under, in display order, with their public labels.
 * Every country names one in its `group`. For finding a country quickly, not a political statement:
 * Egypt is Africa, Turkey and the Caucasus are the Middle East.
 */
export const COUNTRY_GROUPS = [
  { id: 'china', nameZh: '中國內地及港澳台' },
  { id: 'northeast-asia', nameZh: '日本及韓國' },
  { id: 'southeast-asia', nameZh: '東南亞' },
  { id: 'south-central-asia', nameZh: '南亞及中亞' },
  { id: 'middle-east', nameZh: '中東' },
  { id: 'europe', nameZh: '歐洲' },
  { id: 'americas', nameZh: '美洲' },
  { id: 'africa', nameZh: '非洲' },
  { id: 'oceania', nameZh: '大洋洲' },
  { id: 'polar', nameZh: '南北極' }, // only shown once the data has an entry in it
] as const;
export type CountryGroupId = (typeof COUNTRY_GROUPS)[number]['id'];

export interface Country { id: string; nameZh: string; nameEn: string; aliases: string[]; group: CountryGroupId }
/** A part of the world with its countries, in the order they were given. */
export interface CountryGroup { id: CountryGroupId; nameZh: string; countries: Country[] }
export interface Region { id: string; countryId: string; nameZh: string; nameEn: string; aliases: string[] }
export interface City { id: string; regionId: string; nameZh: string; nameEn: string; aliases: string[] }
export interface PlacesData {
  countries: Country[]; regions: Region[]; cities: City[];
  /** Names that contain a city name but are not that city, e.g. 松山湖 (Dongguan), which contains 松山. */
  notPlaces?: string[];
  /**
   * Exact city names known to collide with a place elsewhere, e.g. 塔林 (Tallinn, and the Shaolin Pagoda Forest
   * in Henan). A lone foreign stop named so amid a one-country route is dropped (see extractStops).
   */
  collisionNames?: string[];
}

export interface PlacesIndex {
  data: PlacesData;
  /** Every country under its group: groups in display order, countries in data order, no empty group. */
  countryGroups: CountryGroup[];
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

/**
 * Arranges countries under their groups: groups in COUNTRY_GROUPS order, each country keeping its place in
 * `countries`. A group with none of the given countries is left out.
 */
export function groupCountries(countries: Country[]): CountryGroup[] {
  const byGroup = groupBy(countries, c => c.group);
  return COUNTRY_GROUPS.flatMap(({ id, nameZh }) => {
    const members = byGroup.get(id);
    return members ? [{ id, nameZh, countries: members }] : [];
  });
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
    countryGroups: groupCountries(data.countries),
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
