import type { IsoDate, NormalisedTour, ScrapedDeparture, ScrapedTour } from './types';
import type { PlacesIndex } from './places/index';
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

/** Departures on or after today, one per date with its lowest known price, sorted by date. */
function upcomingDepartures(departures: ScrapedDeparture[], today: IsoDate): ScrapedDeparture[] {
  const priceByDate = new Map<IsoDate, number | null>();
  for (const { date, priceHkd } of departures) {
    if (date < today) continue;
    priceByDate.set(date, priceByDate.has(date) ? lowerPrice(priceByDate.get(date)!, priceHkd) : priceHkd);
  }
  return [...priceByDate]
    .map(([date, priceHkd]) => ({ date, priceHkd }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** today: 'YYYY-MM-DD' in Hong Kong. Departures before today are dropped. */
export function normaliseTour(scraped: ScrapedTour, index: PlacesIndex, today: IsoDate): NormaliseResult {
  const start = normaliseStartPoint(scraped.startPoint, index);
  const end = normaliseStartPoint(scraped.endPoint, index);

  const excluded = [HONG_KONG_CITY_ID];
  if (start.kind === 'sz' || end.kind === 'sz') excluded.push(SHENZHEN_CITY_ID);
  const { stops, unmatched } = extractStops(scraped.dayHeadings, index, excluded);

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
