import { groupCountries, type Country, type CountryGroupId, type Destination, type PlacesIndex, type Region } from '@hktours/core';
import type { DestinationCounts, ListedCount } from '@hktours/db/read';
import type { T } from './i18n';
import { placeName } from './place-names';

// A destination's page is '/tours/<id>' in each language ('/tours/japan', '/en/tours/china-beijing'): the id of a
// country or of a region from the places data, exactly what the search address accepted as `dest=` before. Cities
// have no page. These addresses are permanent once search engines have indexed them.

/** The destinations index's path, without a language. */
export const TOURS_PATH = '/tours' as const;

/** The destination an id names: a region (with its country), or a whole country; undefined for anything else. */
export function destinationFromId(id: string, places: PlacesIndex): Destination | undefined {
  const region = places.region(id);
  if (region) return { countryId: region.countryId, regionId: region.id };
  if (places.country(id)) return { countryId: id, regionId: null };
  return undefined;
}

/** The id in a destination's address: the region's, or the country's for the whole country. */
export function destinationId(destination: Destination): string {
  return destination.regionId ?? destination.countryId;
}

/** A destination's page ('/tours/japan'), or the search page ('/') for none. A path without a language: see localeHref. */
export function destinationPath(destination: Destination | null | undefined): '/' | `/tours/${string}` {
  return destination ? `${TOURS_PATH}/${destinationId(destination)}` : '/';
}

/** An area region (華東, 東北): it names regions it covers and finds only the tours whose own place it is. */
export function isArea(destination: Destination, places: PlacesIndex): boolean {
  return destination.regionId !== null && places.region(destination.regionId)?.members !== undefined;
}

/** The only region of its country (法國 → 法國): it lists exactly the country's tours, so its page repeats the country's. */
export function isOnlyRegion(destination: Destination, places: PlacesIndex): boolean {
  return destination.regionId !== null && places.regionsOf(destination.countryId).length === 1;
}

const NONE: ListedCount = { tours: 0, operators: 0 };

/** How many tours are listed for a destination now, and from how many operators (none when it has no line). */
export function countOf(destination: Destination, counts: DestinationCounts): ListedCount {
  const line = counts.destinations.find(d => d.countryId === destination.countryId && d.regionId === destination.regionId);
  return line ? { tours: line.tours, operators: line.operators } : NONE;
}

/**
 * True for a destination with a page of its own for search engines: listed in the destinations index and the
 * sitemap, and not marked noindex. It has tours now, and its page is not a narrower copy of another: not an area
 * region, and not the only region of its country. Every other destination's page still answers, marked noindex.
 */
export function isListed(destination: Destination, places: PlacesIndex, counts: DestinationCounts): boolean {
  return countOf(destination, counts).tours > 0 && !isArea(destination, places) && !isOnlyRegion(destination, places);
}

export interface IndexRegion { region: Region; destination: Destination; count: ListedCount }
export interface IndexCountry { country: Country; destination: Destination; count: ListedCount; regions: IndexRegion[] }
export interface IndexGroup { id: CountryGroupId; countries: IndexCountry[] }

/**
 * Every listed destination, arranged as the country picker arranges countries: parts of the world in their order,
 * countries in data order, each with its listed regions in data order. A part of the world with no listed country
 * is left out.
 */
export function destinationIndex(places: PlacesIndex, counts: DestinationCounts): IndexGroup[] {
  const listed = (d: Destination) => isListed(d, places, counts);
  return groupCountries(places.data.countries).flatMap(group => {
    const countries = group.countries.flatMap(country => {
      const destination: Destination = { countryId: country.id, regionId: null };
      if (!listed(destination)) return [];
      const regions = places.regionsOf(country.id).flatMap(region => {
        const d: Destination = { countryId: country.id, regionId: region.id };
        return listed(d) ? [{ region, destination: d, count: countOf(d, counts) }] : [];
      });
      return [{ country, destination, count: countOf(destination, counts), regions }];
    });
    return countries.length > 0 ? [{ id: group.id, countries }] : [];
  });
}

/** A part of the world in the directory (destinationDirectory): its countries with listed regions, then those without. */
export interface DirectoryGroup { id: CountryGroupId; withRegions: IndexCountry[]; withoutRegions: IndexCountry[] }

/** Most tours first; equal counts keep their order (the sort is stable). */
function byMostTours<T extends { count: ListedCount }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => b.count.tours - a.count.tours);
}

/**
 * The destinations index's page (/tours): the index's destinations, the same ones, arranged as a directory. Parts of
 * the world in their order; in each, the countries with at least one listed region (each a line with its regions),
 * then the countries with none (together in one grid); countries and regions most tours first, ties in the index's
 * order. The index itself (destinationIndex) keeps the data's order for the sitemap and the band.
 */
export function destinationDirectory(places: PlacesIndex, counts: DestinationCounts): DirectoryGroup[] {
  return destinationIndex(places, counts).map(group => {
    const countries = byMostTours(group.countries).map(country => ({ ...country, regions: byMostTours(country.regions) }));
    return {
      id: group.id,
      withRegions: countries.filter(country => country.regions.length > 0),
      withoutRegions: countries.filter(country => country.regions.length === 0),
    };
  });
}

/** Every listed destination, in the index's order: each country, then its regions. */
export function listedDestinations(places: PlacesIndex, counts: DestinationCounts): Destination[] {
  return destinationIndex(places, counts).flatMap(g => g.countries.flatMap(c => [c.destination, ...c.regions.map(r => r.destination)]));
}

/** How many destinations the gold band offers as shortcuts. */
export const SHORTCUT_COUNT = 7;

/**
 * The countries with the most tours now, for the gold band's shortcuts: every listed country (isListed), most tours
 * first, equal counts in the index's order; at most `n`. Countries only, so a country and its own regions are never
 * offered side by side (日本, 日本關西). From the counts the page already has, so no extra read.
 */
export function topDestinations(
  places: PlacesIndex, counts: DestinationCounts, n: number = SHORTCUT_COUNT,
): { destination: Destination; count: ListedCount }[] {
  return listedDestinations(places, counts)
    .filter(destination => destination.regionId === null)
    .map((destination, order) => ({ destination, count: countOf(destination, counts), order }))
    .sort((a, b) => b.count.tours - a.count.tours || a.order - b.order)
    .slice(0, Math.max(0, n))
    .map(({ destination, count }) => ({ destination, count }));
}

/**
 * A destination's name for headings and titles, in `t`'s language: the country's name ('日本'), or a region's
 * with its country (dest.regionOf: '日本關西', 'Kansai, Japan'), unless the region's name already holds the
 * country's ('Northern Taiwan', 'East China').
 */
export function destinationName(destination: Destination, places: PlacesIndex, t: T): string {
  const country = places.country(destination.countryId);
  const countryName = country ? placeName(country, t.locale) : destination.countryId;
  if (destination.regionId === null) return countryName;
  const region = places.region(destination.regionId);
  const regionName = region ? placeName(region, t.locale) : destination.regionId;
  return regionName.includes(countryName) ? regionName : t('dest.regionOf', { region: regionName, country: countryName });
}
