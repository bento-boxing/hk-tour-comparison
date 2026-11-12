import { z } from 'zod';
import { OPERATOR_IDS, type ScrapedTour } from './types';

const MIN_PRICE_HKD = 100;
const MAX_PRICE_HKD = 2_000_000;

/** True when `s` is a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Reads a whole-dollar HKD price from operator text such as `HK$7,999起`.
 * Takes the first run of digits (commas allowed), ignores any decimal part,
 * and returns null when there is no number or it is under 100.
 */
export function parsePriceHkd(text: string): number | null {
  const match = /\d[\d,]*/.exec(text);
  if (!match) return null;
  const value = Number(match[0].replaceAll(',', ''));
  return value >= MIN_PRICE_HKD ? value : null;
}

const priceHkd = z.number().int().min(MIN_PRICE_HKD).max(MAX_PRICE_HKD).nullable();

const isoDate = z.string().refine(isIsoDate, 'Expected a real date as YYYY-MM-DD');

// https scheme, a host, and no whitespace anywhere.
const httpsUrl = z.string().regex(/^https:\/\/[^\s/?#]+\S*$/, 'Expected an https URL');

export const scrapedTourSchema: z.ZodType<ScrapedTour> = z.object({
  operatorId: z.enum(OPERATOR_IDS),
  code: z.string().min(1),
  url: httpsUrl,
  title: z.string(),
  days: z.number().int().min(1).max(60),
  nights: z.number().int().nonnegative().nullable(),
  dayHeadings: z.array(z.string()),
  startPoint: z.string().nullable(),
  endPoint: z.string().nullable(),
  fromPriceHkd: priceHkd,
  departures: z.array(z.object({ date: isoDate, priceHkd })),
});
