export const OPERATOR_IDS = ['egl', 'jetour', 'texpert', 'bigline'] as const;
export type OperatorId = (typeof OPERATOR_IDS)[number];
export type IsoDate = string; // 'YYYY-MM-DD'

export interface ScrapedDeparture { date: IsoDate; priceHkd: number | null }

/** What an operator parser returns. Raw facts, not yet matched to places. */
export interface ScrapedTour {
  operatorId: OperatorId;
  code: string;            // operator's own tour code, non-empty
  url: string;             // operator's page for this tour, https
  title: string;
  days: number;            // integer 1..60
  nights: number | null;
  dayHeadings: string[];   // one per itinerary day, in order, heading text only
  startPoint: string | null; // raw text if the operator states it
  endPoint: string | null;
  fromPriceHkd: number | null; // operator's displayed "from" price, if any
  departures: ScrapedDeparture[]; // not sold out; may include past dates
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
