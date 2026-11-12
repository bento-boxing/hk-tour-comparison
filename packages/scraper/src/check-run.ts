export interface RunCheckInput {
  toursNormalised: number;          // tours that passed normaliseTour
  tourPagesFetched: number;         // pages the scraper fetched as tour pages
  parseFailures: number;            // parser null, schema failure, or normaliseTour 'no-stops' / 'no-price'
  previousGoodCount: number | null; // from previousGoodTourCount
}

export type RunFailureReason = 'no-tours' | 'tour-count-dropped' | 'too-many-parse-failures';

/** Tonight must have at least 60% of the last good count. */
export const MIN_COUNT_RATIO = 0.6;
/** The ratio rule applies only when the last good count was at least this. */
export const MIN_PREVIOUS_FOR_RATIO = 20;
export const MAX_PARSE_FAILURE_RATE = 0.2;

/**
 * Decides whether one operator's run is trustworthy enough to save.
 * Returns every reason that applies, in a fixed order; ok only when there are none.
 * Ratios are compared as integer divisions so exact boundaries (60%, 20%) are not
 * disturbed by floating-point multiplication.
 */
export function checkRun(input: RunCheckInput): { ok: boolean; reasons: RunFailureReason[] } {
  const { toursNormalised, tourPagesFetched, parseFailures, previousGoodCount } = input;
  const reasons: RunFailureReason[] = [];

  if (toursNormalised === 0) reasons.push('no-tours');

  if (
    previousGoodCount !== null && previousGoodCount >= MIN_PREVIOUS_FOR_RATIO
    && toursNormalised / previousGoodCount < MIN_COUNT_RATIO
  ) reasons.push('tour-count-dropped');

  if (tourPagesFetched > 0 && parseFailures / tourPagesFetched > MAX_PARSE_FAILURE_RATE) {
    reasons.push('too-many-parse-failures');
  }

  return { ok: reasons.length === 0, reasons };
}
