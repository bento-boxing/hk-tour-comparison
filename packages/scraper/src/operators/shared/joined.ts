import type { ScrapedTour } from '@hktours/core';
import { isObject, type JsonObject } from './json';

// The joined text fetchPage hands to parse, and the readers that reject a page with a reason (task 62: the same code
// was in EGL, Big Line, Yummy, Sunflower and Taste).

/** A tour's answers as the one text the pipeline hands to `parse`: their JSON. */
export function joinJson(parts: object): string {
  return JSON.stringify(parts);
}

/**
 * The parts of a joinJson text (or a fixture written as one): `read` is given the JSON object and returns the parts, or
 * null when they are not what it needs. null for text that is not JSON or not a JSON object.
 */
export function splitJson<T>(text: string, read: (value: JsonObject) => T | null): T | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  return isObject(value) ? read(value) : null;
}

/** A reader's answer: the tour, or why the page is not one (a fixed text, never the page's own). */
export type TourOrWhy = ScrapedTour | { why: string };

/** The tour, or null when the reader rejected the page. */
export function tourOrNull(result: TourOrWhy): ScrapedTour | null {
  return 'why' in result ? null : result;
}

/**
 * The tour; throws the reason when the reader rejected the page, so the runner counts a parse failure either way and
 * the crawl log says why.
 */
export function tourOrThrow(result: TourOrWhy): ScrapedTour {
  if ('why' in result) throw new Error(result.why);
  return result;
}
