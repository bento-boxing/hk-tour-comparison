import type { IsoDate, NormalisedTour, ScrapedDeparture, ScrapedTour, Stop, TourPoint } from './types';
import { normaliseName, type PlacesIndex } from './places/index';
import { extractStops } from './stops';
import { normaliseStartPoint } from './start-point';

export type NormaliseResult =
  | { ok: true; tour: NormalisedTour; unmatched: string[] }
  | { ok: false; reason: 'no-stops' | 'no-departures' | 'no-price'; unmatched: string[] };

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
  const stops = withoutStatedEnds(extracted.stops, start, end, index);

  if (stops.length === 0) {
    const reported = unmatched.length > 0
      ? unmatched
      : scraped.dayHeadings.map(heading => [...heading].slice(0, MAX_UNMATCHED_HEADING_LENGTH).join(''));
    return { ok: false, reason: 'no-stops', unmatched: reported };
  }

  const departures = upcomingDepartures(scraped.departures, today);
  if (departures.length === 0) return { ok: false, reason: 'no-departures', unmatched };

  const fromPriceHkd = departures.reduce<number | null>((low, d) => lowerPrice(low, d.priceHkd), null)
    ?? scraped.fromPriceHkd;
  if (fromPriceHkd === null) return { ok: false, reason: 'no-price', unmatched };

  const { operatorId, code, url, title, days, nights } = scraped;
  return {
    ok: true,
    tour: { operatorId, code, url, title, days, nights, stops, start, end, fromPriceHkd, departures },
    unmatched,
  };
}
