// Patterns shared by the operators (task 62).

/**
 * `大阪/東京`, `杭州／上海`, `無錫/南京/上海`: either place, as in a flight leg into or out of one of two airports.
 * Read by the day-line rules of EGL, Charming and Jetour.
 */
export const EITHER_OR = /^[^/／]+(?:[/／][^/／]+)+$/;

/** A departure date, `YYYY-MM-DD`, optionally followed by a time (`T…`): the date is captured. EGL and Travel Expert. */
export const ISO_DATE = /^(\d{4}-\d{2}-\d{2})(?:T|$)/;

/** Removes the stop at `index` if there is one and it is an either/or leg (`大阪/東京`). */
export function withoutEitherOr(stops: string[], index: number): string[] {
  return index >= 0 && EITHER_OR.test(stops[index] ?? '') ? stops.filter((_, i) => i !== index) : stops;
}
