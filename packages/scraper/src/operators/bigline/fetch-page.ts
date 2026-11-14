import type { IsoDate } from '@hktours/core';
import { MAX_CONSECUTIVE_PUSHBACK } from '../../polite-fetch';
import type { Fetcher, PageSkip } from '../../types';
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
 * JSON `code`s (inside an HTTP 200) that mean the API will not serve us or asks us to slow down. They,
 * a JSON answer with no code, a 200 answer that is not JSON (a block page) and no answer at all count
 * toward MAX_CONSECUTIVE_PUSHBACK. Any other code other
 * than 200 fails only that tour (`500 "404 NOT_FOUND"` on a detail: the tour is gone, a skip).
 */
const REFUSAL_CODES = [401, 403, 429, 503];
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

/** The API's answer for a tour id it no longer has (as for its own robots.txt): code 500, msg `404 NOT_FOUND`. */
const GONE_CODE = 500;
const GONE_MESSAGE = '404 NOT_FOUND';

/**
 * An answer's JSON, or what else it is. `why` is for the error message: only the code, never the API's text
 * (the message is read only to recognise GONE_MESSAGE).
 */
function read(text: string):
  { json: Record<string, unknown> } | { gone: true } | { refused: boolean; why: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { refused: true, why: 'the answer is not JSON (a block page?)' };
  }
  if (!isObject(json)) return { refused: true, why: 'the answer is not a JSON object' };
  const code = typeof json.code === 'number' && Number.isInteger(json.code) ? json.code : null;
  if (code === OK) return { json };
  if (code === GONE_CODE && json.msg === GONE_MESSAGE) return { gone: true };
  return { refused: code === null || REFUSAL_CODES.includes(code), why: `the API answered code ${code ?? 'none'}` };
}

/**
 * After this many gone answers in a row, nothing more is requested and every later tour fails as not fetched
 * (so the run fails its fetch-failure check). The crawl of 2026-11-14 met no gone tour in 587, so ten in a row
 * almost certainly means the endpoint was renamed or answers not-found for everything, and stopping saves
 * hundreds of wasted requests; ten is still enough for a run of tours genuinely removed together.
 */
export const MAX_GONE_IN_A_ROW = 10;

/** One kind of request's refusals in a row: only a success of the same kind starts the count again. */
interface RefusalCount { what: string; inARow: number }

/**
 * Big Line's fetchPage: one tour's detail (GET), then its dates for each month to request from the month of
 * the run's `today` (one POST each, see monthsToRequest), through the run's fetcher, which spaces, checks and
 * logs every request. Only the public facts (public.ts) are kept and joined for `parse`.
 * - null, a page not fetched, when a request gets no answer (the fetcher gave up, or a POST failed: it is
 *   sent once); it throws (also counted as not fetched, with the reason in the run's log) when the API
 *   answers with an error code or a page that is not JSON.
 * - `{ skip: 'gone' }` when the detail answers code 500 with exactly `404 NOT_FOUND`: the tour no longer
 *   exists. After MAX_GONE_IN_A_ROW of those in a row, nothing more is requested.
 * - Refusals are counted separately for the detail and for the dates, each started again only by a success
 *   of its own kind, so a good detail cannot hide refused dates. A refusal is no answer, a code 401/403/429,
 *   or a page that is not JSON. When either count reaches MAX_CONSECUTIVE_PUSHBACK, nothing more is sent for
 *   the rest of the process: nothing is retried, escalated or varied.
 */
export function createFetchPage(): (fetcher: Fetcher, url: string, today: IsoDate) => Promise<string | PageSkip | null> {
  const detailRefusals: RefusalCount = { what: 'tour detail', inARow: 0 };
  const datesRefusals: RefusalCount = { what: 'dates', inARow: 0 };
  let goneInARow = 0;

  /**
   * The answer's JSON (code 200), 'gone', or null for no answer (counted as a refusal); throws for an error
   * code or a page that is not JSON.
   */
  async function answer(request: Promise<string | null>, count: RefusalCount, what: string): Promise<Record<string, unknown> | 'gone' | null> {
    const text = await request;
    if (text === null) {
      count.inARow++;
      return null;
    }
    const result = read(text);
    if ('json' in result) {
      count.inARow = 0;
      if (count === detailRefusals) goneInARow = 0;
      return result.json;
    }
    if ('gone' in result) return 'gone';
    if (result.refused) count.inARow++;
    throw new Error(`${what}: ${result.why}`);
  }

  return async (fetcher, url, today) => {
    for (const count of [detailRefusals, datesRefusals]) {
      if (count.inARow >= MAX_CONSECUTIVE_PUSHBACK) {
        throw new Error(`not requested: the Big Line API refused ${MAX_CONSECUTIVE_PUSHBACK} ${count.what} requests in a row`);
      }
    }
    if (goneInARow >= MAX_GONE_IN_A_ROW) {
      throw new Error(`not requested: ${MAX_GONE_IN_A_ROW} tours in a row answered not found; the API may have changed`);
    }
    const id = tourIdOf(url);
    if (id === null) throw new Error('not a Big Line tour page');

    const detailJson = await answer(fetcher.fetchText(detailUrl(id)), detailRefusals, 'tour detail');
    if (detailJson === null) return null;
    if (detailJson === 'gone') {
      goneInARow++;
      return { skip: 'gone' };
    }
    const detail = publicDetail(detailJson);
    const months: TourResponses['months'] = [];
    for (const yearMonth of monthsToRequest(detail.data?.availableMonths, today)) {
      if (fetcher.postJson === undefined) throw new Error('this fetcher cannot POST, and the dates need a POST');
      const datesJson = await answer(fetcher.postJson(DATES_URL, datesBody(id, yearMonth)), datesRefusals, `dates for ${yearMonth}`);
      if (datesJson === null) return null;
      if (datesJson === 'gone') throw new Error(`dates for ${yearMonth}: the API answered code ${GONE_CODE}`);
      months.push({ yearMonth, dates: publicDates(datesJson) });
    }
    return joinTour({ detail, months });
  };
}
