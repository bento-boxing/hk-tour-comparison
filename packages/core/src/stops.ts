import type { Stop } from './types';
import { normaliseName } from './places/index';
import type { City, PlacesIndex, Region } from './places/index';
import { SHORT_TRIP_MAX_DAYS, SHORT_TRIP_REGION_IDS, SHORT_TRIP_REGION_IDS_WITHOUT_CHINA } from './places/short-trips';

export interface StopsResult { stops: Stop[]; unmatched: string[] }

const DEFAULT_EXCLUDED_CITY_IDS = ['hongkong-hongkong-hongkong'];

/** `第一天`, `第1天`, `第 1 日`, `Day 1`, `DAY1`, `D1`, then any `:` `：` `-` or spaces. */
export const DAY_MARKER = /^\s*(?:第\s*[0-9０-９一二三四五六七八九十〇零兩]+\s*[天日]|d(?:ay)?\s*[0-9０-９]+)[\s:：-]*/i;
const BRACKETED = /\([^)]*\)|（[^）]*）|【[^】]*】|\[[^\]]*\]/g;
/** Separators between heading chunks: arrow-type marks, list marks and whitespace, plus U+FE0F so ✈️ splits like ✈. */
export const CHUNK_SEPARATORS = /[→➝⇒✈～~\-－–—>＞｜|、，,\s\uFE0F]+/;
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

/** Every normalised name a city is matched by (PlacesIndex.matchNames) of at least 2 characters, longest first. */
function containedNameList(index: PlacesIndex): string[] {
  const names = new Set<string>();
  for (const city of index.data.cities) {
    for (const name of index.matchNames(city)) {
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

/** Whether the occurrence of `name` at `at` in `key` is to be passed over. */
type Skip = (key: string, at: number, name: string) => boolean;

/**
 * Where `name` first occurs in `key` outside every span and not passed over, or -1. An occurrence the skip rule
 * passes over is added to `spans`, so that no shorter name inside it is read either (`小香格里拉` is not 里拉).
 */
function firstOccurrenceOutside(key: string, name: string, spans: Span[], skip?: Skip): number {
  for (let at = key.indexOf(name); at !== -1; at = key.indexOf(name, at + 1)) {
    if (spans.some(([start, end]) => start <= at && at + name.length <= end)) continue;
    if (skip?.(key, at, name) === true) {
      spans.push([at, at + name.length]);
      continue;
    }
    return at;
  }
  return -1;
}

/**
 * Comparison markers (fallback text only, owner request 2026-11-14): a place name with one of these directly before
 * it (`廣東小香格里拉`, `東方威尼斯`, `廣東版《麗江古城》`, opening quote marks between them allowed) or after it
 * (`巴黎風格`, `東京式`) says what a place is like, not where the tour goes. Checked on 2026-11-14 (task 33) against
 * every Big Line title of that day's crawl, every title of the Sunflower listing and, for evidence only, every day
 * heading of the saved crawl logs. Left out because there they removed the place the tour goes to: `X風情`
 * (`感受夜廣州風情` on Guangzhou tours), `X風` (`丹霞山風景區`) and `X版` (`陽朔版“千裡江山圖”`: X is the real
 * place, what follows the likeness). No name in the places data is a marker plus another listed name, and a listed
 * name beginning with a marker (小欖, 小樽) is read whole as the longest name, so the rule never removes one.
 */
const COMPARISON_PREFIXES = ['小', '東方', '版'];
const COMPARISON_SUFFIXES = ['風格', '式'];
/** Opening quote marks that may stand between a prefix marker and the name (`版“茶卡鹽湖”`). */
const OPENING_QUOTES = /[“‘"'「『《〈]+$/;

/** The prefix marker that counts only after a place name (`廣東版麗江古城`), not after an edition word (`豪華版大阪`). */
const AFTER_A_PLACE_ONLY = '版';
/** The longest place name looked for before 版, in characters. */
const MAX_NAME_LENGTH = 12;

/** Every normalised country, region and city name and alias of at least 2 characters. */
function placeNameSet(index: PlacesIndex): Set<string> {
  const names = new Set<string>();
  for (const place of [...index.data.countries, ...index.data.regions, ...index.data.cities]) {
    for (const name of [place.nameZh, ...place.aliases]) {
      const key = normaliseName(name);
      if ([...key].length >= 2) names.add(key);
    }
  }
  return names;
}

/** True when `text` ends with a place name. */
function endsWithPlaceName(text: string, placeNames: Set<string>): boolean {
  for (let length = 2; length <= Math.min(MAX_NAME_LENGTH, text.length); length++) {
    if (placeNames.has(text.slice(-length))) return true;
  }
  return false;
}

/**
 * True when the name at `at` is directly attached to a comparison marker. 版 counts only right after a place name
 * (`廣東版麗江古城`, `韓國版聖托里尼`): after an edition word (`豪華版大阪`, `精華版廣州`, `升級版桂林`) the place is
 * where the tour goes (review of task 33, 2026-11-14).
 */
const comparisonRule = (index: PlacesIndex): Skip => {
  let placeNames: Set<string> | undefined;
  return (key, at, name) => {
    const before = key.slice(0, at).replace(OPENING_QUOTES, '');
    if (COMPARISON_SUFFIXES.some(marker => key.startsWith(marker, at + name.length))) return true;
    return COMPARISON_PREFIXES.some(marker => {
      if (!before.endsWith(marker)) return false;
      if (marker !== AFTER_A_PLACE_ONLY) return true;
      placeNames ??= placeNameSet(index);
      return endsWithPlaceName(before.slice(0, -marker.length), placeNames);
    });
  };
};

/**
 * Rule 4 (fallback text only, owner decision 2026-11-15): a place name directly followed by 航空 (`澳門航空`,
 * `廈門航空公司`), or by 航 ending its words (`廈航`'s long form `廈門航`), names an airline, not where the tour goes.
 * Derived from the name and the suffix, not from a list of airlines. 航 followed by anything else is left alone:
 * `珠海航展` (the Zhuhai airshow) and `X航班` (a flight to X) are about the place. No name in the places data
 * contains 航, so no real place is cut by the rule.
 */
const isAirline: Skip = (key, at, name) => {
  const after = at + name.length;
  return key.startsWith('航空', after) || (key.startsWith('航', after) && after + 1 === key.length);
};

/** A skip rule that passes over a name when any of the given rules does. */
const anyOf = (rules: Skip[]): Skip | undefined =>
  rules.length === 0 ? undefined : (key, at, name) => rules.some(rule => rule(key, at, name));

/**
 * Cities whose name is the longest city name contained in the token; ties go to the earliest in the token.
 * A city name lying inside a notPlaces entry in the token does not count, nor one the skip rule passes over.
 */
function citiesContainedIn(token: string, index: PlacesIndex, cityNames: string[], notPlaces: string[], skip?: Skip): City[] {
  const key = normaliseName(token);
  const spans = notPlaceSpans(key, notPlaces);
  let best: string | undefined;
  let bestAt = -1;
  for (const name of cityNames) {
    if (best !== undefined && [...name].length < [...best].length) break;
    const at = firstOccurrenceOutside(key, name, spans, skip);
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
 * The route without each region-only stop (cityId null) whose region also has a city stop anywhere in the route,
 * before or after it, and without the consecutive repeats that leaves (see ScrapedTour.dropRegionWithListedCity).
 */
export function withoutRegionsOfListedCities(stops: Stop[]): Stop[] {
  const regionsWithCities = new Set(stops.filter(stop => stop.cityId !== null).map(stop => stop.regionId));
  return withoutRepeats(stops.filter(stop => stop.cityId !== null || !regionsWithCities.has(stop.regionId)));
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

export interface ExtractOptions {
  /** Fallback text only: a place name attached to a comparison marker is not a stop (COMPARISON_PREFIXES, …_SUFFIXES). */
  comparisonsAreNotPlaces?: boolean;
  /** Fallback text only: a place name forming an airline's name is not a stop (isAirline). */
  airlinesAreNotPlaces?: boolean;
  /**
   * Fallback text only: an excluded city's name (Hong Kong, a stated start) is passed over inside a run of text, so it
   * does not take the run's one city and hide the place after it (`香港直航#廣西南寧`). Day headings keep reading the
   * earliest city of a run, as before.
   */
  passOverExcludedCities?: boolean;
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
  options: ExtractOptions = {},
): StopsResult {
  const excluded = new Set(excludeCityIds);
  const isExcludedCity: Skip = (_key, _at, name) => index.findCity(name).every(city => excluded.has(city.id));
  const skip = anyOf([
    ...(options.passOverExcludedCities === true ? [isExcludedCity] : []),
    ...(options.comparisonsAreNotPlaces === true ? [comparisonRule(index)] : []),
    ...(options.airlinesAreNotPlaces === true ? [isAirline] : []),
  ]);
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
      if (cities.length === 0) cities = citiesContainedIn(token, index, cityNames, notPlaces, skip);
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

/** Why a route read from fallback text left a place out (see extractFallbackStops). */
export type FallbackRule = 'comparison' | 'airline' | 'too-far' | 'lone-country';
export interface FallbackDrop { name: string; rule: FallbackRule }
export interface FallbackStopsResult { stops: Stop[]; dropped: FallbackDrop[] }

const stopKey = (stop: Stop) => stop.cityId ?? `region:${stop.regionId}`;

function placeName(stop: Stop, index: PlacesIndex): string {
  return stop.cityId !== null ? index.city(stop.cityId)!.nameZh : index.region(stop.regionId)!.nameZh;
}

/**
 * The one place alone in its country, when another country holds two or more places; otherwise undefined. Places
 * are counted once however often the route returns to them (`杜拜 → 斯里巴加灣 → 杜拜` is one place in each). With two
 * or more countries of one place each (a multi-country title: `巴黎 尼斯 羅馬 蘇黎世`) no one place is alone, and none
 * goes. Mainland China, Macau and Taiwan (the group 中國內地及港澳台) count as one country here: the places data keeps
 * them apart for the filters, but a Zhuhai tour crossing to Macau has no foreign stop.
 */
function loneStopOf(stops: Stop[], index: PlacesIndex): Stop | undefined {
  const countryOf = (stop: Stop) => (index.country(stop.countryId)?.group === 'china' ? 'china' : stop.countryId);
  const placesPerCountry = new Map<string, Set<string>>();
  for (const stop of stops) placesPerCountry.set(countryOf(stop), (placesPerCountry.get(countryOf(stop)) ?? new Set()).add(stopKey(stop)));
  const sizes = [...placesPerCountry.values()].map(set => set.size);
  const alone = [...placesPerCountry].filter(([, set]) => set.size === 1);
  if (alone.length !== 1 || !sizes.some(size => size >= 2)) return undefined;
  const [[country]] = alone;
  return stops.find(stop => countryOf(stop) === country);
}

/**
 * The route fallback text names (ScrapedTour.fallbackRoute: a tour title, not a list of places): the day-heading
 * rules, then four more that day headings never get (owner requests 2026-11-14 and 15), in this order:
 * - comparisons are not places, while reading (COMPARISON_PREFIXES, COMPARISON_SUFFIXES: `廣東小香格里拉`);
 * - airlines are not places, while reading (isAirline: `澳門航空`);
 * - too far for the trip: on a tour of at most SHORT_TRIP_MAX_DAYS days, a stop outside SHORT_TRIP_REGION_IDS goes,
 *   and so does one in SHORT_TRIP_REGION_IDS_WITHOUT_CHINA (Seoul, Busan) when the route has a China-group stop;
 * - a lone foreign stop (loneStopOf): the one place alone in its country, on a route with another country of two or
 *   more places, goes (one place in each of two countries stays).
 * Every place left out is listed once per rule, by name. Unmatched words are not returned: a title is not a list of
 * place names.
 */
export function extractFallbackStops(
  text: string,
  days: number,
  index: PlacesIndex,
  excludeCityIds: string[] = DEFAULT_EXCLUDED_CITY_IDS,
): FallbackStopsResult {
  const dropped: FallbackDrop[] = [];
  const noteDrop = (stop: Stop, rule: FallbackRule) => {
    const name = placeName(stop, index);
    if (!dropped.some(d => d.name === name && d.rule === rule)) dropped.push({ name, rule });
  };
  const keepOnly = (stops: Stop[], keep: (stop: Stop) => boolean, rule: FallbackRule): Stop[] => {
    for (const stop of stops) if (!keep(stop)) noteDrop(stop, rule);
    return withoutRepeats(stops.filter(keep));
  };

  // The rules applied while reading, each in turn; a place one of them removes is one the text gives without it.
  const read = (options: ExtractOptions) => extractStops([text], index, excludeCityIds, options).stops;
  const noteRemoved = (before: Stop[], after: Stop[], rule: FallbackRule) => {
    const kept = new Set(after.map(stopKey));
    for (const stop of before) if (!kept.has(stopKey(stop))) noteDrop(stop, rule);
  };
  const plain = read({ passOverExcludedCities: true });
  const withoutComparisons = read({ passOverExcludedCities: true, comparisonsAreNotPlaces: true });
  noteRemoved(plain, withoutComparisons, 'comparison');
  let stops = read({ passOverExcludedCities: true, comparisonsAreNotPlaces: true, airlinesAreNotPlaces: true });
  noteRemoved(withoutComparisons, stops, 'airline');

  if (days <= SHORT_TRIP_MAX_DAYS) {
    const hasChinaStop = stops.some(stop => index.country(stop.countryId)?.group === 'china');
    const nearEnough = (stop: Stop) => SHORT_TRIP_REGION_IDS.includes(stop.regionId)
      && !(hasChinaStop && SHORT_TRIP_REGION_IDS_WITHOUT_CHINA.includes(stop.regionId));
    stops = keepOnly(stops, nearEnough, 'too-far');
  }

  const lone = loneStopOf(stops, index);
  if (lone !== undefined) stops = keepOnly(stops, stop => stopKey(stop) !== stopKey(lone), 'lone-country');

  return { stops, dropped };
}
