import type { IsoDate } from '@hktours/core';
import { MAX_CONSECUTIVE_PUSHBACK } from '../../polite-fetch';
import type { Fetcher } from '../../types';
import { isObject } from '../shared/json';
import { joinJson, splitJson } from '../shared/joined';
import { datesUrl, detailUrl, tourIdOf } from './discover';
import { publicDates, publicDetail, type PublicDates, type PublicDetail } from './public';

/** The API's `code` for a successful answer (`{"code":1,"msg":"返回成功",…}`). */
const OK = 1;

/** What `parse` reads for one tour: the public facts of its detail and of its dates. */
export interface TourResponses { detail: PublicDetail; dates: PublicDates }

/** The tour's answers as the one text the pipeline hands to `parse`. */
export function joinTour(tour: TourResponses): string {
  return joinJson(tour);
}

/** The answers of a `joinTour` text (or a fixture written as one); null for any other text. */
export function splitTour(text: string): TourResponses | null {
  return splitJson(text, value => (isObject(value.detail) && isObject(value.dates) ? value as unknown as TourResponses : null));
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

/** One kind of request's refusals in a row: only a success of the same kind starts the count again. */
interface RefusalCount { what: string; inARow: number }

/**
 * Yummy Holiday's fetchPage: one tour's detail, then its dates, each a plain GET through the run's fetcher
 * (which spaces, checks and logs every request), with no extra headers. Only the public facts (public.ts) are
 * kept and joined for `parse`. Two requests per tour, every night: nothing is cached across nights.
 * - null, a page not fetched, when a request gets no answer (the fetcher gave up, or a non-200 status); the
 *   dates are not requested when the detail got none.
 * - It throws (also counted as not fetched, with the reason in the run's log) when an answer is not JSON or
 *   carries a code other than 1.
 * - Refusals are counted separately for the details and for the dates, each in a row and started again only by a
 *   success of its own kind, so details that answer cannot hide refused dates (or the other way round). A refusal
 *   is any answer that is not a success: none, not JSON, or a code other than 1. When either count reaches
 *   MAX_CONSECUTIVE_PUSHBACK, nothing more is sent for the rest of the process (no detail, no dates): nothing is
 *   retried, escalated or varied.
 */
export function createFetchPage(): (fetcher: Fetcher, url: string, today: IsoDate) => Promise<string | null> {
  const detailRefusals: RefusalCount = { what: 'tour detail', inARow: 0 };
  const datesRefusals: RefusalCount = { what: 'dates', inARow: 0 };

  /** The answer's JSON, or null for no answer; throws for an answer that is not a success. */
  async function answer(request: Promise<string | null>, count: RefusalCount): Promise<Record<string, unknown> | null> {
    const text = await request;
    if (text === null) {
      count.inARow++;
      return null;
    }
    const result = read(text);
    if ('json' in result) {
      count.inARow = 0;
      return result.json;
    }
    count.inARow++;
    throw new Error(`${count.what}: ${result.why}`);
  }

  return async (fetcher, url) => {
    for (const count of [detailRefusals, datesRefusals]) {
      if (count.inARow >= MAX_CONSECUTIVE_PUSHBACK) {
        throw new Error(`not requested: the Yummy Holiday API refused ${MAX_CONSECUTIVE_PUSHBACK} ${count.what} requests in a row`);
      }
    }
    const id = tourIdOf(url);
    if (id === null) throw new Error('not a Yummy Holiday tour page');
    const detail = await answer(fetcher.fetchText(detailUrl(id)), detailRefusals);
    if (detail === null) return null;
    const dates = await answer(fetcher.fetchText(datesUrl(id)), datesRefusals);
    if (dates === null) return null;
    return joinTour({ detail: publicDetail(detail), dates: publicDates(dates) });
  };
}
