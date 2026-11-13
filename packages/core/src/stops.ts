import type { Stop } from './types';
import { normaliseName } from './places/index';
import type { City, PlacesIndex, Region } from './places/index';

export interface StopsResult { stops: Stop[]; unmatched: string[] }

const DEFAULT_EXCLUDED_CITY_IDS = ['hongkong-hongkong-hongkong'];

/** `第一天`, `第1天`, `第 1 日`, `Day 1`, `DAY1`, `D1`, then any `:` `：` `-` or spaces. */
const DAY_MARKER = /^\s*(?:第\s*[0-9０-９一二三四五六七八九十〇零兩]+\s*[天日]|d(?:ay)?\s*[0-9０-９]+)[\s:：-]*/i;
const BRACKETED = /\([^)]*\)|（[^）]*）|【[^】]*】|\[[^\]]*\]/g;
/** Separators between heading chunks: arrow-type marks, list marks and whitespace, plus U+FE0F so ✈️ splits like ✈. */
const CHUNK_SEPARATORS = /[→➝⇒✈～~\-－–—>＞｜|、，,\s\uFE0F]+/;
/** Separators between the alternatives of one chunk (`深圳北/廣州南`). */
const ALTERNATIVE_SEPARATORS = /[/／]+/;
/** A chunk naming a connection (`途經巴黎轉機`, `中轉深圳北/廣州南`) is not a visit, nor are its alternatives. */
const TRANSIT_WORDS = ['轉機', '中轉', '轉乘', '過境'];
const CJK = /\p{Script=Han}/u;
const IGNORED_WORDS = [
  '機場', '酒店', '自由活動', '全日', '原居地', '啟程', '回程', '返港', '抵達', '出發',
  '市內觀光', '送機', '接機', '晚餐', '午餐', '早餐',
];

/** The place tokens of a heading: without its day marker, bracketed notes and transit chunks. */
function tokensOf(heading: string): string[] {
  return heading
    .replace(DAY_MARKER, '')
    .replace(BRACKETED, ' ')
    .split(CHUNK_SEPARATORS)
    .filter(chunk => !TRANSIT_WORDS.some(word => chunk.includes(word)))
    .flatMap(chunk => chunk.split(ALTERNATIVE_SEPARATORS))
    .filter(token => token !== '');
}

/** Every normalised city name and alias of at least 2 characters, longest first. */
function containedNameList(index: PlacesIndex): string[] {
  const names = new Set<string>();
  for (const city of index.data.cities) {
    for (const name of [city.nameZh, ...city.aliases]) {
      const key = normaliseName(name);
      if ([...key].length >= 2) names.add(key);
    }
  }
  return [...names].sort((a, b) => [...b].length - [...a].length);
}

/** Every normalised notPlaces entry. */
function notPlaceList(index: PlacesIndex): string[] {
  return (index.data.notPlaces ?? []).map(normaliseName).filter(name => name !== '');
}

type Span = [start: number, end: number];

/** Where each notPlaces entry occurs in `key`. */
function notPlaceSpans(key: string, notPlaces: string[]): Span[] {
  const spans: Span[] = [];
  for (const entry of notPlaces) {
    for (let at = key.indexOf(entry); at !== -1; at = key.indexOf(entry, at + 1)) spans.push([at, at + entry.length]);
  }
  return spans;
}

/** Where `name` first occurs in `key` outside every span, or -1. */
function firstOccurrenceOutside(key: string, name: string, spans: Span[]): number {
  for (let at = key.indexOf(name); at !== -1; at = key.indexOf(name, at + 1)) {
    if (!spans.some(([start, end]) => start <= at && at + name.length <= end)) return at;
  }
  return -1;
}

/**
 * Cities whose name is the longest city name contained in the token; ties go to the earliest in the token.
 * A city name lying inside a notPlaces entry in the token does not count.
 */
function citiesContainedIn(token: string, index: PlacesIndex, cityNames: string[], notPlaces: string[]): City[] {
  const key = normaliseName(token);
  const spans = notPlaceSpans(key, notPlaces);
  let best: string | undefined;
  let bestAt = -1;
  for (const name of cityNames) {
    if (best !== undefined && [...name].length < [...best].length) break;
    const at = firstOccurrenceOutside(key, name, spans);
    if (at !== -1 && (best === undefined || at < bestAt)) {
      best = name;
      bestAt = at;
    }
  }
  return best === undefined ? [] : index.findCity(best);
}

function isReportable(token: string): boolean {
  const length = [...token].length;
  return length >= 2 && length <= 8 && CJK.test(token) && !IGNORED_WORDS.some(word => token.includes(word));
}

function sameStop(a: Stop, b: Stop): boolean {
  return a.cityId !== null || b.cityId !== null ? a.cityId === b.cityId : a.regionId === b.regionId;
}

/** The stops without consecutive repeats. */
function withoutRepeats(stops: Stop[]): Stop[] {
  const route: Stop[] = [];
  for (const stop of stops) {
    const previous = route[route.length - 1];
    if (previous === undefined || !sameStop(previous, stop)) route.push(stop);
  }
  return route;
}

/**
 * Where the route's single foreign outlier is, or -1: the one stop in a country no other stop is in,
 * neither first nor last, amid at least three other stops all in one other country. Only a place named
 * by a collisionNames entry counts (塔林, the Shaolin Pagoda Forest, read as Tallinn): real cross-border
 * stops such as Kirkenes on a Lapland tour look the same.
 */
function loneForeignStopAt(route: Stop[], isCollision: (stop: Stop) => boolean): number {
  const stopsPerCountry = new Map<string, number>();
  for (const stop of route) stopsPerCountry.set(stop.countryId, (stopsPerCountry.get(stop.countryId) ?? 0) + 1);
  if (stopsPerCountry.size !== 2) return -1;
  const [[firstCountry, firstCount], [secondCountry, secondCount]] = [...stopsPerCountry];
  const loneCountry = firstCount === 1 && secondCount >= 3 ? firstCountry
    : secondCount === 1 && firstCount >= 3 ? secondCountry : undefined;
  if (loneCountry === undefined) return -1;
  const at = route.findIndex(stop => stop.countryId === loneCountry);
  return at === 0 || at === route.length - 1 || !isCollision(route[at]) ? -1 : at;
}

/**
 * The route the day headings name. Transit chunks give no stops; a single foreign outlier (see
 * loneForeignStopAt) is removed and its name reported as unmatched, for review.
 * excludeCityIds: places never shown on a route (Hong Kong, and the tour's start/end city).
 */
export function extractStops(
  dayHeadings: string[],
  index: PlacesIndex,
  excludeCityIds: string[] = DEFAULT_EXCLUDED_CITY_IDS,
): StopsResult {
  const cityNames = containedNameList(index);
  const notPlaces = notPlaceList(index);
  const stops: Stop[] = [];
  const unmatched: string[] = [];
  const countryOfRegion = (regionId: string) => index.region(regionId)!.countryId;

  /** One match when the name is unambiguous; otherwise prefer a country already visited, else the first and flag the token. */
  const choose = <T>(token: string, matches: T[], countryOf: (match: T) => string): T => {
    if (new Set(matches.map(countryOf)).size > 1) {
      const visited = new Set(stops.map(stop => stop.countryId));
      const preferred = matches.find(match => visited.has(countryOf(match)));
      if (preferred !== undefined) return preferred;
      unmatched.push(token);
    }
    return matches[0];
  };
  const cityStop = (city: City): Stop =>
    ({ countryId: countryOfRegion(city.regionId), regionId: city.regionId, cityId: city.id });
  const regionStop = (region: Region): Stop =>
    ({ countryId: region.countryId, regionId: region.id, cityId: null });

  for (const heading of dayHeadings) {
    for (const token of tokensOf(heading)) {
      let cities = index.findCity(token);
      if (cities.length === 0) cities = citiesContainedIn(token, index, cityNames, notPlaces);
      if (cities.length > 0) {
        stops.push(cityStop(choose(token, cities, city => countryOfRegion(city.regionId))));
        continue;
      }
      const regions = index.findRegion(token);
      if (regions.length > 0) {
        stops.push(regionStop(choose(token, regions, region => region.countryId)));
        continue;
      }
      if (index.findCountry(token).length > 0) continue;
      if (isReportable(token)) unmatched.push(token);
    }
  }

  const excluded = new Set(excludeCityIds);
  let route = withoutRepeats(stops.filter(stop => stop.cityId === null || !excluded.has(stop.cityId)));
  const collisionNames = new Set((index.data.collisionNames ?? []).map(normaliseName));
  const placeOf = (stop: Stop): City | Region =>
    stop.cityId !== null ? index.city(stop.cityId)! : index.region(stop.regionId)!;
  const isCollision = (stop: Stop) =>
    [placeOf(stop).nameZh, ...placeOf(stop).aliases].some(name => collisionNames.has(normaliseName(name)));
  const outlierAt = loneForeignStopAt(route, isCollision);
  if (outlierAt !== -1) {
    unmatched.push(placeOf(route[outlierAt]).nameZh);
    route = withoutRepeats(route.filter((_, at) => at !== outlierAt));
  }
  return { stops: route, unmatched: [...new Set(unmatched)] };
}
