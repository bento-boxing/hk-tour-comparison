export const OPERATOR_IDS = ['egl', 'jetour', 'texpert', 'bigline', 'charming', 'yummy', 'sunflower', 'taste'] as const;
export type OperatorId = (typeof OPERATOR_IDS)[number];
export type IsoDate = string; // 'YYYY-MM-DD'

export interface ScrapedDeparture { date: IsoDate; priceHkd: number | null }

/** What an operator parser returns. Raw facts, not yet matched to places. */
export interface ScrapedTour {
  operatorId: OperatorId;
  code: string;            // operator's own tour code, non-empty
  url: string;             // operator's page for this tour, https
  title: string;
  days: number;            // integer 1..60; the route's too-far rule reads it (SHORT_TRIP_MAX_DAYS)
  nights: number | null;
  dayHeadings: string[];   // one per itinerary day, in order, heading text only
  startPoint: string | null; // raw text if the operator states it
  endPoint: string | null;
  fromPriceHkd: number | null; // operator's displayed "from" price, if any
  departures: ScrapedDeparture[]; // not sold out; may include past dates
  /**
   * Opt-in, for an operator whose day headings often name no place: text read only when the headings give no stop
   * after their rules (extractDayLineStops: comparisons, too far for the trip), with the day-heading rules and the
   * fallback rules after them (extractFallbackStops: those two, a lone foreign stop, airlines), its unmatched words not
   * reported. Several texts are read in order, and the
   * first that gives a stop after its rules is the route. Big Line sets its title (owner decision 2026-11-14);
   * Sunflower its title, subarea and area for a Guangdong short trip, else its area then its title (2026-11-15).
   */
  fallbackRoute?: string | string[];
  /**
   * Opt-in, for an operator whose route is a list of place tags rather than day headings: a region-only stop (a
   * province matched with no city) is dropped when a city of that region is also a stop, wherever either sits in
   * the list. Yummy Holiday sets it (owner decision 2026-11-14: `雲南,大理,瀘沽湖,麗江,昆明` is the four cities);
   * every other operator leaves it out.
   */
  dropRegionWithListedCity?: boolean;
}

export interface Stop { countryId: string; regionId: string; cityId: string | null }
export type StartKind = 'hk' | 'sz' | 'other';
export interface TourPoint { kind: StartKind; label: string | null } // label only when 'other'

/** A tour ready to save. */
export interface NormalisedTour {
  operatorId: OperatorId; code: string; url: string; title: string;
  days: number; nights: number | null;
  stops: Stop[];                 // at least one
  start: TourPoint; end: TourPoint;
  fromPriceHkd: number;          // lowest known price
  departures: ScrapedDeparture[]; // at least one, sorted by date, unique dates
}

export const tourKey = (operatorId: OperatorId, code: string) => `${operatorId}:${code}`;
