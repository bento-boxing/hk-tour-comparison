import type { IsoDate } from '@hktours/core';
import { MAX_CONSECUTIVE_PUSHBACK } from '../../polite-fetch';
import type { Fetcher } from '../../types';
import { datesUrl, detailUrl, tourIdOf } from './discover';
import { publicDates, publicDetail, type PublicDates, type PublicDetail } from './public';

/** The API's `code` for a successful answer (`{"code":1,"msg":"返回成功",…}`). */
const OK = 1;

/** What `parse` reads for one tour: the public facts of its detail and of its dates. */
export interface TourResponses { detail: PublicDetail; dates: PublicDates }

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
  if (!isObject(value) || !isObject(value.detail) || !isObject(value.dates)) return null;
  return value as unknown as TourResponses;
}

/**
 * An answer's JSON, or why it is not one. `why` is for the error message: only the code, never the API's text.
 */
function read(text: string): { json: Record<string, unknown> } | { why: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { why: 'the answer is not JSON (a block page?)' };
  }
  if (!isObject(json)) return { why: 'the answer is not a JSON object' };
  if (json.code === OK) return { json };
  const code = typeof json.code === 'number' && Number.isInteger(json.code) ? json.code : 'none';
  return { why: `the API answered code ${code}` };
}

/**
 * Yummy Holiday's fetchPage: one tour's detail, then its dates, each a plain GET through the run's fetcher
 * (which spaces, checks and logs every request), with no extra headers. Only the public facts (public.ts) are
 * kept and joined for `parse`. Two requests per tour, every night: nothing is cached across nights.
 * - null, a page not fetched, when a request gets no answer (the fetcher gave up, or a non-200 status); the
 *   dates are not requested when the detail got none.
 * - It throws (also counted as not fetched, with the reason in the run's log) when an answer is not JSON or
 *   carries a code other than 1.
 * - Every answer that is not a success (none, not JSON, another code) counts toward one count of refusals in
 *   a row; any success starts it again. At MAX_CONSECUTIVE_PUSHBACK, nothing more is sent for the rest of the
 *   process: nothing is retried, escalated or varied.
 */
export function createFetchPage(): (fetcher: Fetcher, url: string, today: IsoDate) => Promise<string | null> {
  let refusedInARow = 0;

  /** The answer's JSON, or null for no answer; throws for an answer that is not a success. */
  async function answer(request: Promise<string | null>, what: string): Promise<Record<string, unknown> | null> {
    const text = await request;
    if (text === null) {
      refusedInARow++;
      return null;
    }
    const result = read(text);
    if ('json' in result) {
      refusedInARow = 0;
      return result.json;
    }
    refusedInARow++;
    throw new Error(`${what}: ${result.why}`);
  }

  return async (fetcher, url) => {
    if (refusedInARow >= MAX_CONSECUTIVE_PUSHBACK) {
      throw new Error(`not requested: the Yummy Holiday API refused ${MAX_CONSECUTIVE_PUSHBACK} requests in a row`);
    }
    const id = tourIdOf(url);
    if (id === null) throw new Error('not a Yummy Holiday tour page');
    const detail = await answer(fetcher.fetchText(detailUrl(id)), 'tour detail');
    if (detail === null) return null;
    const dates = await answer(fetcher.fetchText(datesUrl(id)), 'dates');
    if (dates === null) return null;
    return joinTour({ detail: publicDetail(detail), dates: publicDates(dates) });
  };
}
