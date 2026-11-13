import type { Stop } from './types';
import { normaliseName } from './places/index';
import type { City, PlacesIndex, Region } from './places/index';

export interface StopsResult { stops: Stop[]; unmatched: string[] }

const DEFAULT_EXCLUDED_CITY_IDS = ['hongkong-hongkong-hongkong'];

/** `第一天`, `第1天`, `第 1 日`, `Day 1`, `DAY1`, `D1`, then any `:` `：` `-` or spaces. */
const DAY_MARKER = /^\s*(?:第\s*[0-9０-９一二三四五六七八九十〇零兩]+\s*[天日]|d(?:ay)?\s*[0-9０-９]+)[\s:：-]*/i;
const BRACKETED = /\([^)]*\)|（[^）]*）|【[^】]*】|\[[^\]]*\]/g;
/** The listed separators and whitespace, plus U+FE0F so the emoji form ✈️ splits like ✈. */
const SEPARATORS = /[→➝⇒✈～~\-－–—>＞/／、，,｜|\s️]+/;
const CJK = /\p{Script=Han}/u;
const IGNORED_WORDS = [
  '機場', '酒店', '自由活動', '全日', '原居地', '啟程', '回程', '返港', '抵達', '出發',
  '市內觀光', '送機', '接機', '晚餐', '午餐', '早餐',
];

function tokensOf(heading: string): string[] {
  return heading
    .replace(DAY_MARKER, '')
    .replace(BRACKETED, ' ')
    .split(SEPARATORS)
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

/** excludeCityIds: places never shown on a route (Hong Kong, and the tour's start/end city). */
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
  const route: Stop[] = [];
  for (const stop of stops) {
    if (stop.cityId !== null && excluded.has(stop.cityId)) continue;
    const previous = route[route.length - 1];
    if (previous === undefined || !sameStop(previous, stop)) route.push(stop);
  }
  return { stops: route, unmatched: [...new Set(unmatched)] };
}
