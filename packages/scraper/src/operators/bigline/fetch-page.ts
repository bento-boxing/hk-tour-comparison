import { todayInHongKong, type IsoDate } from '@hktours/core';
import { MAX_CONSECUTIVE_PUSHBACK } from '../../polite-fetch';
import type { Fetcher } from '../../types';
import { DATES_URL, datesBody, detailUrl, tourIdOf } from './discover';
import { publicDates, publicDetail, type PublicDates, type PublicDetail } from './public';

/**
 * At most this many months of departures are requested per tour, each a separate POST: the first months
 * the detail's `availableMonths` lists, from the current Hong Kong month on. The owner chose 3 on
 * 2026-11-13 to fit the 170-minute nightly job: 586 tours × (1 detail + 3 months) × 3 s is about 2 hours.
 */
export const MAX_MONTHS_PER_TOUR = 3;

const YEAR_MONTH = /^[0-9]{4}-(?:0[1-9]|1[0-2])$/;
/**
 * JSON `code`s (inside an HTTP 200) that mean the API will not serve us. They, and a 200 answer that is
 * not JSON (a block page), count toward MAX_CONSECUTIVE_PUSHBACK. Any other code other than 200 (such as
 * `500 "404 NOT_FOUND"` for a tour that is gone) fails only that tour.
 */
const REFUSAL_CODES = [401, 403, 429];
const OK = 200;

/** What `parse` reads for one tour: the public facts of the detail and of each month requested. */
export interface TourResponses { detail: PublicDetail; months: { yearMonth: string; dates: PublicDates }[] }

/** The tour's answers as the one text the pipeline hands to `parse`. */
export function joinTour(tour: TourResponses): string {
  return JSON.stringify(tour);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The answers of a `joinTour` text (or a fixture written as one); null for any other text. */
export function splitTour(text: string): TourResponses | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(value) || !isObject(value.detail) || !Array.isArray(value.months)) return null;
  const monthsOk = value.months.every(month =>
    isObject(month) && typeof month.yearMonth === 'string' && isObject(month.dates));
  return monthsOk ? (value as unknown as TourResponses) : null;
}

/**
 * The months to request: at most MAX_MONTHS_PER_TOUR of the listed `YYYY-MM` months, from the month of
 * `today` (Hong Kong) on, earliest first, each once. Anything else in the list is skipped, so only a
 * checked month can go into a request.
 */
export function monthsToRequest(availableMonths: unknown, today: IsoDate): string[] {
  const current = today.slice(0, 7);
  const months = new Set<string>();
  for (const month of Array.isArray(availableMonths) ? availableMonths : []) {
    if (typeof month === 'string' && YEAR_MONTH.test(month) && month >= current) months.add(month);
  }
  return [...months].sort().slice(0, MAX_MONTHS_PER_TOUR);
}

/** An answer's JSON, or why it is not usable (for the error message: only the code, never the API's text). */
function read(text: string): { json: Record<string, unknown> } | { refused: boolean; why: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { refused: true, why: 'the answer is not JSON (a block page?)' };
  }
  if (!isObject(json)) return { refused: true, why: 'the answer is not a JSON object' };
  const code = typeof json.code === 'number' && Number.isInteger(json.code) ? json.code : null;
  if (code === OK) return { json };
  return { refused: code !== null && REFUSAL_CODES.includes(code), why: `the API answered code ${code ?? 'none'}` };
}

export interface FetchPageOptions {
  /** Today in Hong Kong; defaults to the clock. */
  today?: () => IsoDate;
}

/**
 * Big Line's fetchPage: one tour's detail (GET), then its dates for each month to request (one POST each,
 * see monthsToRequest), through the run's fetcher, which spaces, checks and logs every request. Only the
 * public facts (public.ts) are kept and joined for `parse`. null, a page not fetched, when a request gets
 * no answer; it throws (also counted as not fetched, with the reason in the run's log) when the API
 * answers with an error code or a page that is not JSON. After MAX_CONSECUTIVE_PUSHBACK refusals in a row
 * it sends nothing more for the rest of the process: nothing is retried, escalated or varied.
 */
export function createFetchPage(opts: FetchPageOptions = {}): (fetcher: Fetcher, url: string) => Promise<string | null> {
  const today = opts.today ?? (() => todayInHongKong());
  let refusalsInARow = 0;

  /** The answer's JSON (code 200), or null for no answer; throws for an error code or a page that is not JSON. */
  async function answer(request: Promise<string | null>, what: string): Promise<Record<string, unknown> | null> {
    const text = await request;
    if (text === null) return null;
    const result = read(text);
    if ('json' in result) {
      refusalsInARow = 0;
      return result.json;
    }
    if (result.refused) refusalsInARow++;
    throw new Error(`${what}: ${result.why}`);
  }

  return async (fetcher, url) => {
    if (refusalsInARow >= MAX_CONSECUTIVE_PUSHBACK) {
      throw new Error(`not requested: the Big Line API refused ${MAX_CONSECUTIVE_PUSHBACK} requests in a row`);
    }
    const id = tourIdOf(url);
    if (id === null) throw new Error('not a Big Line tour page');

    const detailJson = await answer(fetcher.fetchText(detailUrl(id)), 'tour detail');
    if (detailJson === null) return null;
    const detail = publicDetail(detailJson);
    const months: TourResponses['months'] = [];
    for (const yearMonth of monthsToRequest(detail.data?.availableMonths, today())) {
      if (fetcher.postJson === undefined) throw new Error('this fetcher cannot POST, and the dates need a POST');
      const datesJson = await answer(fetcher.postJson(DATES_URL, datesBody(id, yearMonth)), `dates for ${yearMonth}`);
      if (datesJson === null) return null;
      months.push({ yearMonth, dates: publicDates(datesJson) });
    }
    return joinTour({ detail, months });
  };
}
