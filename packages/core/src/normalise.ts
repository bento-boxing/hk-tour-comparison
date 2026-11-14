import type { IsoDate, NormalisedTour, ScrapedDeparture, ScrapedTour, Stop, TourPoint } from './types';
import { normaliseName, type PlacesIndex } from './places/index';
import { extractFallbackStops, extractStops, withoutRegionsOfListedCities, type FallbackDrop } from './stops';
import { normaliseStartPoint } from './start-point';

/**
 * routeFromFallback: the stops came from ScrapedTour.fallbackRoute. fallbackDropped: present when that text was read
 * and its rules (extractFallbackStops) left places out, so a crawl log can show them.
 */
export type NormaliseResult =
  | { ok: true; tour: NormalisedTour; unmatched: string[]; routeFromFallback: boolean; fallbackDropped?: FallbackDrop[] }
  | { ok: false; reason: 'no-stops' | 'no-departures' | 'no-price'; unmatched: string[]; fallbackDropped?: FallbackDrop[] };

const HONG_KONG_CITY_ID = 'hongkong-hongkong-hongkong';
const SHENZHEN_CITY_ID = 'china-guangdong-shenzhen';
const MAX_UNMATCHED_HEADING_LENGTH = 40;

/** Lower of two prices, where null means unknown. */
function lowerPrice(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

/** True when the stop is a city whose name or an alias (2+ characters) appears in the point's label. */
function isNamedBy(stop: Stop | undefined, point: TourPoint, index: PlacesIndex): boolean {
  if (stop?.cityId == null || point.kind !== 'other' || point.label === null) return false;
  const city = index.city(stop.cityId);
  if (!city) return false;
  const label = normaliseName(point.label);
  return [city.nameZh, ...city.aliases].some(name => {
    const key = normaliseName(name);
    return [...key].length >= 2 && label.includes(key);
  });
}

/**
 * The route without a stated start or end place (kind `other`) at its edges: the first stop when the start
 * point names it, the last when the end point does. The same city in the middle of the route stays.
 */
function withoutStatedEnds(stops: Stop[], start: TourPoint, end: TourPoint, index: PlacesIndex): Stop[] {
  let route = stops;
  if (isNamedBy(route[0], start, index)) route = route.slice(1);
  if (isNamedBy(route.at(-1), end, index)) route = route.slice(0, -1);
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
  const extracted = extractStops(scraped.dayHeadings, index, excluded);
  const { unmatched } = extracted;
  // Opt-in (ScrapedTour.dropRegionWithListedCity): a province given only as a tag beside its own cities is not a stop.
  const listed = scraped.dropRegionWithListedCity === true ? withoutRegionsOfListedCities(extracted.stops) : extracted.stops;
  let stops = withoutStatedEnds(listed, start, end, index);

  // A tour with nothing to book is skipped whatever its route: no-departures comes before no-stops.
  const departures = upcomingDepartures(scraped.departures, today);
  if (departures.length === 0) return { ok: false, reason: 'no-departures', unmatched };

  // Opt-in (ScrapedTour.fallbackRoute): read only when the headings leave no stop, with the heading rules and the
  // fallback rules after them (extractFallbackStops), and its unmatched words are not reported (a title is not a list
  // of place names). Several texts are read in order until one gives a stop; the drops of every text read are listed.
  let routeFromFallback = false;
  let drops: { fallbackDropped?: FallbackDrop[] } = {};
  if (stops.length === 0 && scraped.fallbackRoute !== undefined) {
    const dropped: FallbackDrop[] = [];
    for (const text of typeof scraped.fallbackRoute === 'string' ? [scraped.fallbackRoute] : scraped.fallbackRoute) {
      const fallback = extractFallbackStops(text, scraped.days, index, excluded);
      for (const drop of fallback.dropped) if (!dropped.some(d => d.name === drop.name && d.rule === drop.rule)) dropped.push(drop);
      const listedOnly = scraped.dropRegionWithListedCity === true ? withoutRegionsOfListedCities(fallback.stops) : fallback.stops;
      stops = withoutStatedEnds(listedOnly, start, end, index);
      if (stops.length === 0 && excluded.includes(SHENZHEN_CITY_ID)) stops = shenzhenAlone(text, scraped.days, index);
      if (stops.length > 0) break;
    }
    routeFromFallback = stops.length > 0;
    if (dropped.length > 0) drops = { fallbackDropped: dropped };
  }

  if (stops.length === 0) {
    const reported = unmatched.length > 0
      ? unmatched
      : scraped.dayHeadings.map(heading => [...heading].slice(0, MAX_UNMATCHED_HEADING_LENGTH).join(''));
    return { ok: false, reason: 'no-stops', unmatched: reported, ...drops };
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
