import { parsePriceHkd } from '@hktours/core';

// Small readers of parsed JSON, shared by the operators (task 62). Each behaves exactly as the copies it replaced.

export type JsonObject = Record<string, unknown>;
/** A plain JSON value: string, number, boolean or null. */
export type PlainJson = string | number | boolean | null;

/** True for a JSON object (not an array, not null). */
export const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
/** The value when it is a JSON object, else an empty one. */
export const objectAt = (value: unknown): JsonObject => (isObject(value) ? value : {});
/** The value when it is an array, else an empty one. */
export const arrayAt = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
/** The value when it is a plain JSON value (a finite number, a string, a boolean or null), else null. */
export const plainJson = (value: unknown): PlainJson =>
  (typeof value === 'string' || typeof value === 'boolean' || value === null
    || (typeof value === 'number' && Number.isFinite(value)) ? value : null);
/** True for a whole number. */
export const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/** A positive whole number of days, or null. */
export function dayCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * A price given as a JSON number (`6199.0`), or as numeric text when `allowText`, as whole HKD; null below 100 or if
 * absent (parsePriceHkd). A number is cut to its whole part first.
 */
export function jsonPrice(value: unknown, allowText = false): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return parsePriceHkd(String(Math.trunc(value)));
  if (allowText && typeof value === 'string') return parsePriceHkd(value);
  return null;
}
