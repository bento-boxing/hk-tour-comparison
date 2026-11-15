import type { IsoDate, NormalisedTour, ScrapedDeparture, ScrapedTour, Stop, TourPoint } from './types';
import { normaliseName, type PlacesIndex } from './places/index';
import { extractDayLineStops, extractFallbackStops, withoutRegionsOfListedCities, type RouteDrop } from './stops';
import { normaliseStartPoint } from './start-point';

/**
 * routeFromFallback: the stops came from ScrapedTour.fallbackRoute. dayHeadingsDropped: present when the day-line
 * rules (extractDayLineStops) left places out of the day headings' route; fallbackDropped: present when the fallback
 * text was read and its rules (extractFallbackStops) left places out. Both are there so a crawl log can show them.
 */
export interface RouteDrops { dayHeadingsDropped?: RouteDrop[]; fallbackDropped?: RouteDrop[] }
/**
 * unmatchedAreHeadings: on a no-stops result whose day headings named no place and no word to report, `unmatched` holds
 * the headings themselves (cut to MAX_UNMATCHED_HEADING_LENGTH characters) for review. They are the operator's text,
 * not place words, so a public log prints how many there are instead (run-operator.ts).
 */
export type NormaliseResult =
  | ({ ok: true; tour: NormalisedTour; unmatched: string[]; routeFromFallback: boolean } & RouteDrops)
  | ({ ok: false; reason: 'no-stops' | 'no-departures' | 'no-price'; unmatched: string[]; unmatchedAreHeadings?: true } & RouteDrops);

const HONG_KONG_CITY_ID = 'hongkong-hongkong-hongkong';
const SHENZHEN_CITY_ID = 'china-guangdong-shenzhen';
const MAX_UNMATCHED_HEADING_LENGTH = 40;

/** Lower of two prices, where null means unknown. */
function lowerPrice(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

/**
 * The cities a stated start or end point (kind `other`) names: those whose name or an alias (2+ characters) appears in
 * its label. The one definition of "named by the stated start or end", for withoutStatedEnds and the day-line too-far
 * rule (extractDayLineStops' statedCityIds).
 */
function citiesNamedBy(point: TourPoint, index: PlacesIndex): Set<string> {
  if (point.kind !== 'other' || point.label === null) return new Set();
  const label = normaliseName(point.label);
  return new Set(index.data.cities
    .filter(city => [city.nameZh, ...city.aliases].some(name => {
      const key = normaliseName(name);
      return [...key].length >= 2 && label.includes(key);
    }))
    .map(city => city.id));
}

/**
 * The route without a stated start or end place at its edges: the first stop when the start point names it
 * (citiesNamedBy), the last when the end point does. The same city in the middle of the route stays.
 */
function withoutStatedEnds(stops: Stop[], namedByStart: Set<string>, namedByEnd: Set<string>): Stop[] {
  const namedBy = (stop: Stop | undefined, named: Set<string>) => stop?.cityId != null && named.has(stop.cityId);
  let route = stops;
  if (namedBy(route[0], namedByStart)) route = route.slice(1);
  if (namedBy(route.at(-1), namedByEnd)) route = route.slice(0, -1);
  return route;
}

/**
 * A tour gathering at the Shenzhen border leaves Shenzhen out of its route (it is where the tour starts). But when a
 * fallback text names Shenzhen and no other place (`2天深圳純玩團`), the tour is a Shenzhen day trip: its route is
 * Shenzhen (task 34, 2026-11-15). Fallback text only; day headings are read as before.
 */
function shenzhenAlone(text: string, days: number, index: PlacesIndex): Stop[] {
  const stops = extractFallbackStops(text, days, index, [HONG_KONG_CITY_ID]).stops;
  return stops.length > 0 && stops.every(stop => stop.cityId === SHENZHEN_CITY_ID) ? stops.slice(0, 1) : [];
}

/**
 * Departures after today (the design's "its date is in the future": a tour leaving today has left
 * by the time anyone reads the card), one per date with its lowest known price, sorted by date.
 */
function upcomingDepartures(departures: ScrapedDeparture[], today: IsoDate): ScrapedDeparture[] {
  const priceByDate = new Map<IsoDate, number | null>();
  for (const { date, priceHkd } of departures) {
    if (date <= today) continue;
    priceByDate.set(date, priceByDate.has(date) ? lowerPrice(priceByDate.get(date)!, priceHkd) : priceHkd);
  }
  return [...priceByDate]
    .map(([date, priceHkd]) => ({ date, priceHkd }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** today: 'YYYY-MM-DD' in Hong Kong. Departures on or before today are dropped. */
export function normaliseTour(scraped: ScrapedTour, index: PlacesIndex, today: IsoDate): NormaliseResult {
  const start = normaliseStartPoint(scraped.startPoint, index);
  const end = normaliseStartPoint(scraped.endPoint, index);

  const excluded = [HONG_KONG_CITY_ID];
  if (start.kind === 'sz' || end.kind === 'sz') excluded.push(SHENZHEN_CITY_ID);
  // The day-line rules (comparisons, too far for the trip) come first, so a province and its city, or a stated start or
  // end place, that one of them removes is listed as dropped by it.
  const namedByStart = citiesNamedBy(start, index);
  const namedByEnd = citiesNamedBy(end, index);
  // A place the stated start or end names is a gateway: the day-line too-far rule neither counts nor drops it.
  const extracted = extractDayLineStops(scraped.dayHeadings, scraped.days, index, excluded, new Set([...namedByStart, ...namedByEnd]));
  const { unmatched } = extracted;
  let drops: RouteDrops = extracted.dropped.length > 0 ? { dayHeadingsDropped: extracted.dropped } : {};
  // Opt-in (ScrapedTour.dropRegionWithListedCity): a province given only as a tag beside its own cities is not a stop.
  const listed = scraped.dropRegionWithListedCity === true ? withoutRegionsOfListedCities(extracted.stops) : extracted.stops;
  let stops = withoutStatedEnds(listed, namedByStart, namedByEnd);

  // A tour with nothing to book is skipped whatever its route: no-departures comes before no-stops.
  const departures = upcomingDepartures(scraped.departures, today);
  if (departures.length === 0) return { ok: false, reason: 'no-departures', unmatched, ...drops };

  // Opt-in (ScrapedTour.fallbackRoute): read only when the headings leave no stop (after their rules), with the heading
  // rules and the fallback rules after them (extractFallbackStops), and its unmatched words are not reported (a title is
  // not a list of place names). Several texts are read in order until one gives a stop; the drops of every text read
  // are listed.
  let routeFromFallback = false;
  if (stops.length === 0 && scraped.fallbackRoute !== undefined) {
    const dropped: RouteDrop[] = [];
    for (const text of typeof scraped.fallbackRoute === 'string' ? [scraped.fallbackRoute] : scraped.fallbackRoute) {
      const fallback = extractFallbackStops(text, scraped.days, index, excluded);
      for (const drop of fallback.dropped) if (!dropped.some(d => d.name === drop.name && d.rule === drop.rule)) dropped.push(drop);
      const listedOnly = scraped.dropRegionWithListedCity === true ? withoutRegionsOfListedCities(fallback.stops) : fallback.stops;
      stops = withoutStatedEnds(listedOnly, namedByStart, namedByEnd);
      if (stops.length === 0 && excluded.includes(SHENZHEN_CITY_ID)) stops = shenzhenAlone(text, scraped.days, index);
      if (stops.length > 0) break;
    }
    routeFromFallback = stops.length > 0;
    if (dropped.length > 0) drops = { ...drops, fallbackDropped: dropped };
  }

  if (stops.length === 0) {
    if (unmatched.length > 0) return { ok: false, reason: 'no-stops', unmatched, ...drops };
    const headings = scraped.dayHeadings.map(heading => [...heading].slice(0, MAX_UNMATCHED_HEADING_LENGTH).join(''));
    return { ok: false, reason: 'no-stops', unmatched: headings, unmatchedAreHeadings: true, ...drops };
  }

  // The lowest departure price, or the operator's "from" price when no departure has one. A departure without a
  // price of its own is shown, filtered and chained at this stored price (marked 起), so while any has none the
  // operator's "from" price counts too: such a date is never shown above the price the operator states.
  const lowestDeparture = departures.reduce<number | null>((low, d) => lowerPrice(low, d.priceHkd), null);
  const fromPriceHkd = departures.some(d => d.priceHkd === null)
    ? lowerPrice(lowestDeparture, scraped.fromPriceHkd)
    : lowestDeparture ?? scraped.fromPriceHkd;
  if (fromPriceHkd === null) return { ok: false, reason: 'no-price', unmatched, ...drops };

  const { operatorId, code, url, title, days, nights } = scraped;
  return {
    ok: true,
    tour: { operatorId, code, url, title, days, nights, stops, start, end, fromPriceHkd, departures },
    unmatched,
    routeFromFallback,
    ...drops,
  };
}
