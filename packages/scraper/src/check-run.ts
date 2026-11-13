export interface RunCheckInput {
  toursNormalised: number;          // tours that passed normaliseTour
  tourPagesFetched: number;         // pages the scraper fetched as tour pages
  parseFailures: number;            // parser null, schema failure, or normaliseTour 'no-stops' / 'no-price'
  previousGoodCount: number | null; // from previousGoodTourCount
  minExpectedTours?: number | null; // the scraper's floor for runs with no previous good count
  pagesDiscovered: number;          // distinct tour page URLs the scraper found tonight
  pagesNotFetched: number;          // of those, pages the fetcher could not get (fetchText, or the scraper's fetchPage, gave null)
}

export type RunFailureReason =
  'no-tours' | 'below-minimum' | 'tour-count-dropped' | 'too-many-parse-failures' | 'too-many-fetch-failures';

/** Tonight must have at least 60% of the last good count. */
export const MIN_COUNT_RATIO = 0.6;
/** The ratio rule applies only when the last good count was at least this. */
export const MIN_PREVIOUS_FOR_RATIO = 20;
export const MAX_PARSE_FAILURE_RATE = 0.2;
/**
 * More than this share of the discovered tour pages could not be fetched: the tours on them would
 * be deactivated for a reason that says nothing about the operator's catalogue (a site pushing back, say).
 */
export const MAX_FETCH_FAILURE_RATE = 0.2;

/**
 * Decides whether one operator's run is trustworthy enough to save.
 * Returns every reason that applies, in a fixed order; ok only when there are none.
 * Each rule divides one count by the other and compares the quotient with the limit,
 * rather than multiplying a count by 0.6 or 0.2. Division of two whole numbers is
 * correctly rounded, so a quotient of exactly 60% or 20% equals the limit and passes.
 */
export function checkRun(input: RunCheckInput): { ok: boolean; reasons: RunFailureReason[] } {
  const {
    toursNormalised, tourPagesFetched, parseFailures, previousGoodCount, minExpectedTours = null,
    pagesDiscovered, pagesNotFetched,
  } = input;
  const reasons: RunFailureReason[] = [];

  if (toursNormalised === 0) reasons.push('no-tours');

  // Only with no history: once there is a previous good count, the ratio rule below governs.
  if (
    previousGoodCount === null && minExpectedTours !== null && minExpectedTours > 0
    && toursNormalised < minExpectedTours
  ) reasons.push('below-minimum');

  if (
    previousGoodCount !== null && previousGoodCount >= MIN_PREVIOUS_FOR_RATIO
    && toursNormalised / previousGoodCount < MIN_COUNT_RATIO
  ) reasons.push('tour-count-dropped');

  if (tourPagesFetched > 0 && parseFailures / tourPagesFetched > MAX_PARSE_FAILURE_RATE) {
    reasons.push('too-many-parse-failures');
  }

  if (pagesDiscovered > 0 && pagesNotFetched / pagesDiscovered > MAX_FETCH_FAILURE_RATE) {
    reasons.push('too-many-fetch-failures');
  }

  return { ok: reasons.length === 0, reasons };
}
