import type { Stop } from './types';
import { normaliseName } from './places/index';
import type { City, PlacesIndex, Region } from './places/index';
import { perIndex } from './per-index';
import { SHORT_TRIP_MAX_DAYS, SHORT_TRIP_REGION_IDS, SHORT_TRIP_REGION_IDS_WITHOUT_CHINA } from './places/short-trips';

export interface StopsResult { stops: Stop[]; unmatched: string[] }

const DEFAULT_EXCLUDED_CITY_IDS = ['hongkong-hongkong-hongkong'];

/** `第一天`, `第1天`, `第 1 日`, `Day 1`, `DAY1`, `D1`, then any `:` `：` `-` or spaces. */
export const DAY_MARKER = /^\s*(?:第\s*[0-9０-９一二三四五六七八九十〇零兩]+\s*[天日]|d(?:ay)?\s*[0-9０-９]+)[\s:：-]*/i;
/**
 * Bracketed notes, `(…)` `（…）` `【…】` `[…]`, dropped with their text before a heading is read. Global: for `replace`
 * (or `.source`), not for `test` or `exec`, which would carry `lastIndex` from one call to the next.
 */
export const BRACKETED = /\([^)]*\)|（[^）]*）|【[^】]*】|\[[^\]]*\]/g;
/** Separators between heading chunks: arrow-type marks, list marks and whitespace, plus U+FE0F so ✈️ splits like ✈. */
export const CHUNK_SEPARATORS = /[→➝⇒✈～~\-－–—>＞｜|、，,\s\uFE0F]+/;
/** Separators between the alternatives of one chunk (`深圳北/廣州南`). */
export const ALTERNATIVE_SEPARATORS = /[/／]+/;
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

/**
 * Every normalised name a city is matched by (PlacesIndex.matchNames) of at least 2 characters, longest first. Built
 * once per index (perIndex); never changed by its readers.
 */
const containedNameList = perIndex((index): readonly string[] => {
  const names = new Set<string>();
  for (const city of index.data.cities) {
    for (const name of index.matchNames(city)) {
      const key = normaliseName(name);
      if ([...key].length >= 2) names.add(key);
    }
  }
  return [...names].sort((a, b) => [...b].length - [...a].length);
});

/** Every normalised notPlaces entry. Built once per index (perIndex). */
const notPlaceList = perIndex((index): readonly string[] =>
  (index.data.notPlaces ?? []).map(normaliseName).filter(name => name !== ''));

type Span = [start: number, end: number];

/** Where each notPlaces entry occurs in `key`. */
function notPlaceSpans(key: string, notPlaces: readonly string[]): Span[] {
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
 * Comparison markers (owner requests 2026-11-14 for fallback text, 2026-11-15 for day lines too: extractFallbackStops,
 * extractDayLineStops): a place name with one of these directly before
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

/** Every normalised country, region and city name and alias of at least 2 characters. Built once per index (perIndex). */
const placeNameSet = perIndex((index): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const place of [...index.data.countries, ...index.data.regions, ...index.data.cities]) {
    for (const name of [place.nameZh, ...place.aliases]) {
      const key = normaliseName(name);
      if ([...key].length >= 2) names.add(key);
    }
  }
  return names;
});

/** True when `text` ends with a place name. */
function endsWithPlaceName(text: string, placeNames: ReadonlySet<string>): boolean {
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
  let placeNames: ReadonlySet<string> | undefined;
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
 * What may follow `X航空` when it is not an airline (review of task 34): an airport town or district (`珠海航空城`,
 * but not `航空城市之旅`; `鄭州航空港` or `航空港區`, but not `航空港澳直航`), an air show (`航空展`), an aviation
 * museum or hall (`航空博物館`, `航空館`), a themed town (`航空小鎮`). 航天 (space flight) and 航展 are never read as airlines in the first place. After a flight word
 * (`直航`, `航班`, `包機`), a bracket or nothing, X航空 is an airline. The saved crawl logs hold no other
 * continuation of `<place>航空`.
 */
const NOT_AN_AIRLINE_AFTER = /^(?:城(?!市)|港(?=$|\P{Script=Han}|區|区|經濟|经济|新城)|展|博物館|館|小鎮|主題)/u;

/**
 * Rule 4 (fallback text only, owner decision 2026-11-15): a place name directly followed by 航空 (`澳門航空`,
 * `廈門航空公司`), or by 航 ending its words (`廈航`'s long form `廈門航`), names an airline, not where the tour goes.
 * Derived from the name and the suffix, not from a list of airlines. 航 followed by anything else is left alone:
 * `珠海航展` (the Zhuhai airshow) and `X航班` (a flight to X) are about the place. No name in the places data
 * contains 航, so no real place is cut by the rule. Exceptions: NOT_AN_AIRLINE_AFTER.
 */
const isAirline: Skip = (key, at, name) => {
  const after = at + name.length;
  if (key.startsWith('航空', after)) return !NOT_AN_AIRLINE_AFTER.test(key.slice(after + 2));
  return key.startsWith('航', after) && after + 1 === key.length;
};

/** A skip rule that passes over a name when any of the given rules does. */
const anyOf = (rules: Skip[]): Skip | undefined =>
  rules.length === 0 ? undefined : (key, at, name) => rules.some(rule => rule(key, at, name));

/**
 * Cities whose name is the longest city name contained in the token; ties go to the earliest in the token.
 * A city name lying inside a notPlaces entry in the token does not count, nor one the skip rule passes over.
 */
function citiesContainedIn(
  token: string, index: PlacesIndex, cityNames: readonly string[], notPlaces: readonly string[], skip?: Skip,
): City[] {
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
 * The route without each stop in an area region (Region.members: 華東, 東北) when the route also has a stop, a city
 * or a province alone, in one of the area's members, before or after it, and without the consecutive repeats that
 * leaves (task 40). An area is a group word, not a place: beside a member it says nothing the member does not.
 * Always on, for every operator and every text (extractStops, so day lines and fallback text alike), unlike
 * dropRegionWithListedCity, which an operator opts into for a province given as a tag beside its own city: an area
 * never holds a city, and no operator uses one as a place of its own beside its provinces.
 * uncountedCityIds: city stops that do not count as members here. While reading, these are the cities of the tour's
 * stated start and end, which normaliseTour may yet remove from the route's edges; it applies this rule again, with
 * none uncounted, to what remains (fix round 1, review M2: `上海, 華東` from a stated 上海 keeps 華東, not no stop).
 */
export function withoutAreasOfListedMembers(stops: Stop[], index: PlacesIndex, uncountedCityIds: ReadonlySet<string> = new Set()): Stop[] {
  const regions = new Set(stops.filter(stop => stop.cityId === null || !uncountedCityIds.has(stop.cityId)).map(stop => stop.regionId));
  return withoutRepeats(stops.filter(stop => !(index.region(stop.regionId)?.members ?? []).some(id => regions.has(id))));
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
  /**
   * A place name attached to a comparison marker is not a stop (COMPARISON_PREFIXES, …_SUFFIXES). Set for day lines
   * (extractDayLineStops) and fallback text (extractFallbackStops) alike.
   */
  comparisonsAreNotPlaces?: boolean;
  /** Fallback text only: a place name forming an airline's name is not a stop (isAirline). */
  airlinesAreNotPlaces?: boolean;
  /** Cities that do not count as members of an area while reading (withoutAreasOfListedMembers): the stated ends. */
  areaUncountedCityIds?: ReadonlySet<string>;
  /**
   * Fallback text only: an excluded city's name (Hong Kong, a stated start) is passed over inside a run of text, so it
   * does not take the run's one city and hide the place after it (`香港直航#廣西南寧`). Day headings keep reading the
   * earliest city of a run, as before.
   */
  passOverExcludedCities?: boolean;
}

/**
 * The places the day headings name, read without the route rules unless `options` asks for them (a tour's route is
 * extractDayLineStops or extractFallbackStops, which call this). Transit chunks give no stops; an area beside one of
 * its members gives none either (withoutAreasOfListedMembers); a single foreign outlier (see loneForeignStopAt) is
 * removed and its name reported as unmatched, for review.
 * excludeCityIds: places never shown on a route (Hong Kong, and the tour's start/end city).
 */
export function extractStops(
  dayHeadings: string[],
  index: PlacesIndex,
  excludeCityIds: string[] = DEFAULT_EXCLUDED_CITY_IDS,
  options: ExtractOptions = {},
): StopsResult {
  const { stops, unmatched } = readStops(dayHeadings, index, excludeCityIds, options);
  return { stops, unmatched };
}

/**
 * extractStops, with what the route rules need to know about the reading: the stop the outlier rule removed, if any,
 * and each name a rule applied while reading passed over (a comparison, an airline), by rule.
 */
interface Reading extends StopsResult {
  outlier: Stop | undefined;
  passedOver: { name: string; rule: 'comparison' | 'airline' }[];
}

function readStops(dayHeadings: string[], index: PlacesIndex, excludeCityIds: string[], options: ExtractOptions): Reading {
  const excluded = new Set(excludeCityIds);
  const isExcludedCity: Skip = (_key, _at, name) => index.findCity(name).every(city => excluded.has(city.id));
  const passedOver: Reading['passedOver'] = [];
  const recorded = (rule: 'comparison' | 'airline', test: Skip): Skip => (key, at, name) => {
    const passes = test(key, at, name);
    if (passes) passedOver.push({ name, rule });
    return passes;
  };
  const skip = anyOf([
    ...(options.passOverExcludedCities === true ? [isExcludedCity] : []),
    ...(options.comparisonsAreNotPlaces === true ? [recorded('comparison', comparisonRule(index))] : []),
    ...(options.airlinesAreNotPlaces === true ? [recorded('airline', isAirline)] : []),
  ]);
  const cityNames = containedNameList(index);
  const notPlaces = notPlaceList(index);
  const stops: Stop[] = [];
  const unmatched: string[] = [];
  const countryOfRegion = (regionId: string) => index.region(regionId)!.countryId;

  /** Each token with its city matches (whole, else contained) or, failing those, its region matches. */
  const read = dayHeadings.flatMap(tokensOf).map(token => {
    let cities = index.findCity(token);
    if (cities.length === 0) cities = citiesContainedIn(token, index, cityNames, notPlaces, skip);
    return { token, cities, regions: cities.length > 0 ? [] : index.findRegion(token) };
  });
  // The countries the unambiguous names of the whole text are in, wherever they stand: a shared name (東北: Tohoku or
  // north-east China) is read in the country the rest of the route is in, even when it comes first.
  const routeCountries = new Set(read.flatMap(({ cities, regions }) => {
    const countries = new Set([...cities.map(city => countryOfRegion(city.regionId)), ...regions.map(region => region.countryId)]);
    return countries.size === 1 ? [...countries] : [];
  }));

  /**
   * One match when the name is unambiguous; otherwise prefer a country already visited, then one the rest of the
   * text names, else the first, and flag the token.
   */
  const choose = <T>(token: string, matches: T[], countryOf: (match: T) => string): T => {
    if (new Set(matches.map(countryOf)).size > 1) {
      const visited = new Set(stops.map(stop => stop.countryId));
      const preferred = matches.find(match => visited.has(countryOf(match)))
        ?? matches.find(match => routeCountries.has(countryOf(match)));
      if (preferred !== undefined) return preferred;
      unmatched.push(token);
    }
    return matches[0];
  };
  const cityStop = (city: City): Stop =>
    ({ countryId: countryOfRegion(city.regionId), regionId: city.regionId, cityId: city.id });
  const regionStop = (region: Region): Stop =>
    ({ countryId: region.countryId, regionId: region.id, cityId: null });

  for (const { token, cities, regions } of read) {
    if (cities.length > 0) {
      stops.push(cityStop(choose(token, cities, city => countryOfRegion(city.regionId))));
      continue;
    }
    if (regions.length > 0) {
      stops.push(regionStop(choose(token, regions, region => region.countryId)));
      continue;
    }
    if (index.findCountry(token).length > 0) continue;
    if (isReportable(token)) unmatched.push(token);
  }

  // An area beside its member adds no stop (task 40), before the outlier rule counts the stops.
  let route = withoutAreasOfListedMembers(withoutRepeats(stops.filter(stop => stop.cityId === null || !excluded.has(stop.cityId))), index,
    options.areaUncountedCityIds);
  const collisionNames = new Set((index.data.collisionNames ?? []).map(normaliseName));
  const placeOf = (stop: Stop): City | Region =>
    stop.cityId !== null ? index.city(stop.cityId)! : index.region(stop.regionId)!;
  const isCollision = (stop: Stop) =>
    [placeOf(stop).nameZh, ...placeOf(stop).aliases].some(name => collisionNames.has(normaliseName(name)));
  const outlierAt = loneForeignStopAt(route, isCollision);
  const outlier = outlierAt === -1 ? undefined : route[outlierAt];
  if (outlierAt !== -1) {
    unmatched.push(placeOf(route[outlierAt]).nameZh);
    route = withoutRepeats(route.filter((_, at) => at !== outlierAt));
  }
  return { stops: route, unmatched: [...new Set(unmatched)], outlier, passedOver };
}

/**
 * Why a route left a place out: comparison and too-far for day lines and fallback text alike (extractDayLineStops),
 * airline and lone-country for fallback text only (extractFallbackStops).
 */
export type RouteRule = 'comparison' | 'airline' | 'too-far' | 'lone-country';
export interface RouteDrop { name: string; rule: RouteRule }
export interface FallbackStopsResult { stops: Stop[]; dropped: RouteDrop[] }
export interface DayLineStopsResult extends StopsResult { dropped: RouteDrop[] }

const stopKey = (stop: Stop) => stop.cityId ?? `region:${stop.regionId}`;

function placeName(stop: Stop, index: PlacesIndex): string {
  return stop.cityId !== null ? index.city(stop.cityId)!.nameZh : index.region(stop.regionId)!.nameZh;
}

/** The places a route's rules leave out, each listed once per rule by name. */
function dropList(index: PlacesIndex) {
  const dropped: RouteDrop[] = [];
  const note = (stop: Stop, rule: RouteRule) => {
    const name = placeName(stop, index);
    if (!dropped.some(d => d.name === name && d.rule === rule)) dropped.push({ name, rule });
  };
  return {
    dropped,
    /** The stops `keep` accepts, the others listed under `rule`. */
    keepOnly(stops: Stop[], keep: (stop: Stop) => boolean, rule: RouteRule): Stop[] {
      for (const stop of stops) if (!keep(stop)) note(stop, rule);
      return withoutRepeats(stops.filter(keep));
    },
    /**
     * For a rule applied while reading (`after` is the reading with it): each place read without it and not with it
     * is one it removed, when the rule passed over a name of that place. A place missing for another reason is not
     * listed under the rule: a shared name read in another country once a likeness is gone (東北: Tohoku beside
     * 東京, north-east China without it), or an outlier the reading without the likeness did not have.
     */
    noteRemoved(before: Stop[], after: Reading, rule: 'comparison' | 'airline'): void {
      const kept = new Set(after.stops.map(stopKey));
      const passedOver = new Set(after.passedOver.filter(p => p.rule === rule)
        .flatMap(p => index.findCity(p.name).map(city => city.id)));
      for (const stop of before) if (!kept.has(stopKey(stop)) && stop.cityId !== null && passedOver.has(stop.cityId)) note(stop, rule);
    },
  };
}

/**
 * When the too-far rule removes the out-of-reach places (see withinReachOfTrip): 'always' (fallback text), or
 * 'when-fewer' (day lines): only when they are strictly fewer distinct places than those within reach.
 */
type TooFarWhen = 'always' | 'when-fewer';

/**
 * Too far for the trip (owner requests 2026-11-14 for fallback text, 2026-11-15 for day lines): on a tour of at most
 * SHORT_TRIP_MAX_DAYS days, a stop is within reach when it is in SHORT_TRIP_REGION_IDS, except one in
 * SHORT_TRIP_REGION_IDS_WITHOUT_CHINA (Seoul, Busan) on a route with a China-group stop. The stops are those left
 * after the excluded cities (Hong Kong, a Shenzhen start) are removed, so a flight from Hong Kong to Seoul keeps Seoul.
 *
 * The two paths differ (task 35 fix rounds 1 and 2, orchestrator rulings). Fallback text ('always') loses every stop
 * out of reach, even all of them: a title names likenesses and dishes (`峇里風情`, `高山賞紅葉`) beside where the tour
 * goes, and a route of those alone is no route. Day lines ('when-fewer') list where the tour goes, and the rule assumes
 * a tour leaving Hong Kong by road or rail, which a short flight package or a land tour abroad is not: its day lines
 * name a gateway within reach (澳門, 珠海, 深圳, often also its stated start) and a destination beyond it. So on day
 * lines the out-of-reach places go only when they are strictly fewer distinct places (each counted once however often
 * it recurs) than those within reach; otherwise the route stays as read and nothing is listed. `廣州, 上海, 深圳` on 2
 * days loses 上海 (a venue name); `澳門, 大阪, 京都` on 3 days keeps everything. The accepted cost: one place within reach
 * against one beyond it is left alone, so `廣州, 首爾` on 3 days keeps 首爾 even when it is a dish's name.
 *
 * statedCityIds (day lines only; fix round 3): the cities the tour's stated start or end names (normaliseTour's
 * citiesNamedBy, the same test its stated-ends step uses). They are the gateways a flight leaves from and returns to:
 * left out of the count and never dropped by this rule, wherever they stand (the stated-ends step then removes them at
 * the route's edges, as before). So `珠海 → 東京 → 澳門` from a stated 珠海 back to a stated 澳門 keeps 東京.
 */
function withinReachOfTrip(
  stops: Stop[], days: number, index: PlacesIndex, drops: ReturnType<typeof dropList>, when: TooFarWhen,
  statedCityIds: ReadonlySet<string> = new Set(),
): Stop[] {
  if (days > SHORT_TRIP_MAX_DAYS) return stops;
  const hasChinaStop = stops.some(stop => index.country(stop.countryId)?.group === 'china');
  const nearEnough = (stop: Stop) => SHORT_TRIP_REGION_IDS.includes(stop.regionId)
    && !(hasChinaStop && SHORT_TRIP_REGION_IDS_WITHOUT_CHINA.includes(stop.regionId));
  const isStated = (stop: Stop) => stop.cityId !== null && statedCityIds.has(stop.cityId);
  if (when === 'when-fewer') {
    const counted = stops.filter(stop => !isStated(stop));
    const placesWhere = (near: boolean) => new Set(counted.filter(stop => nearEnough(stop) === near).map(stopKey)).size;
    if (placesWhere(false) >= placesWhere(true)) return stops;
  }
  return drops.keepOnly(stops, stop => isStated(stop) || nearEnough(stop), 'too-far');
}

/**
 * The route the day headings name (extractStops: excluded cities, transit chunks, the lone collision-name outlier),
 * with the two rules fallback text also gets (owner decision 2026-11-15), in this order:
 * - comparisons are not places, while reading (COMPARISON_PREFIXES, COMPARISON_SUFFIXES: `東方威尼斯`), so they come
 *   before the excluded cities and the outlier rule, as for fallback text;
 * - the outlier rule (loneForeignStopAt, unchanged) runs inside each reading. A stop it removes in the plain reading
 *   (without comparisons) stays removed, and reported as unmatched, in the comparison reading too: a likeness taken
 *   away must not leave fewer than three stops around a collision name and so bring it back (`中山, 塔林, 東方蘇州,
 *   江門`: 塔林 stays out). The other way round is right as it is: once a likeness is gone, the outlier rule may find a
 *   collision name it did not find beside the likeness (`中山, 珠海, 塔林, 東方威尼斯, 江門`), and removes it;
 * - too far for the trip (withinReachOfTrip, 'when-fewer'), after the excluded cities (Hong Kong is not a China-group
 *   stop that would take Seoul off a flight there) and after the outlier rule: the out-of-reach places go only when
 *   they are fewer than the places within reach (a gateway does not outweigh a flight package's destination), the
 *   places of the stated start and end (statedCityIds; none when the caller has none) left out of both counts.
 * normaliseTour then drops a province beside its own city (when the operator opts in) and a stated start or end place,
 * as for fallback text. Every place a rule leaves out is listed once per rule, by name (a comparison only when the
 * rule passed over its name); it is not added to `unmatched` (the words of a comparison that named nothing else are,
 * as any words that name no place).
 */
export function extractDayLineStops(
  dayHeadings: string[],
  days: number,
  index: PlacesIndex,
  excludeCityIds: string[] = DEFAULT_EXCLUDED_CITY_IDS,
  statedCityIds: ReadonlySet<string> = new Set(),
): DayLineStopsResult {
  const drops = dropList(index);
  const plain = readStops(dayHeadings, index, excludeCityIds, { areaUncountedCityIds: statedCityIds });
  const read = readStops(dayHeadings, index, excludeCityIds, { comparisonsAreNotPlaces: true, areaUncountedCityIds: statedCityIds });
  const outlier = plain.outlier;
  if (outlier !== undefined && read.stops.some(stop => stopKey(stop) === stopKey(outlier))) {
    read.stops = withoutRepeats(read.stops.filter(stop => stopKey(stop) !== stopKey(outlier)));
    const name = placeName(outlier, index);
    if (!read.unmatched.includes(name)) read.unmatched.push(name);
  }
  drops.noteRemoved(plain.stops, read, 'comparison');
  const stops = withinReachOfTrip(read.stops, days, index, drops, 'when-fewer', statedCityIds);
  return { stops, unmatched: read.unmatched, dropped: drops.dropped };
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
 * rules, including the two day lines also get (extractDayLineStops), and two more for fallback text only (owner
 * requests 2026-11-14 and 15), in this order:
 * - comparisons are not places, while reading (COMPARISON_PREFIXES, COMPARISON_SUFFIXES: `廣東小香格里拉`);
 * - airlines are not places, while reading (isAirline: `澳門航空`; fallback text only);
 * - too far for the trip (withinReachOfTrip, 'always'), which here may empty the route: a title whose every place is
 *   out of reach of a short trip names likenesses or dishes, not where the tour goes (day lines drop out-of-reach
 *   places only when they are fewer than those within reach);
 * - a lone foreign stop (loneStopOf; fallback text only): the one place alone in its country, on a route with another
 *   country of two or more places, goes (one place in each of two countries stays).
 * An excluded city is also passed over inside a run of text (passOverExcludedCities; fallback text only).
 * Every place left out is listed once per rule, by name. Unmatched words are not returned: a title is not a list of
 * place names.
 */
export function extractFallbackStops(
  text: string,
  days: number,
  index: PlacesIndex,
  excludeCityIds: string[] = DEFAULT_EXCLUDED_CITY_IDS,
  statedCityIds: ReadonlySet<string> = new Set(),
): FallbackStopsResult {
  const drops = dropList(index);

  // The rules applied while reading, each in turn; a place one of them removes is one the text gives without it.
  // statedCityIds (the tour's stated start and end cities) only keep an area beside them while reading (see
  // withoutAreasOfListedMembers); normaliseTour decides once the stated ends are removed.
  const read = (options: ExtractOptions) => readStops([text], index, excludeCityIds, { ...options, areaUncountedCityIds: statedCityIds });
  const plain = read({ passOverExcludedCities: true });
  const withoutComparisons = read({ passOverExcludedCities: true, comparisonsAreNotPlaces: true });
  drops.noteRemoved(plain.stops, withoutComparisons, 'comparison');
  const withoutAirlines = read({ passOverExcludedCities: true, comparisonsAreNotPlaces: true, airlinesAreNotPlaces: true });
  drops.noteRemoved(withoutComparisons.stops, withoutAirlines, 'airline');

  let stops = withinReachOfTrip(withoutAirlines.stops, days, index, drops, 'always');

  const lone = loneStopOf(stops, index);
  if (lone !== undefined) stops = drops.keepOnly(stops, stop => stopKey(stop) !== stopKey(lone), 'lone-country');

  return { stops, dropped: drops.dropped };
}
