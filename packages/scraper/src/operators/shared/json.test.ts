import { expect, it } from 'vitest';
import { arrayAt, dayCount, isCount, isObject, jsonPrice, objectAt, plainJson } from './json';

it('isObject is true for a JSON object only', () => {
  expect(isObject({})).toBe(true);
  for (const value of [null, [], 'x', 1, undefined]) expect(isObject(value)).toBe(false);
});

it('objectAt and arrayAt give the value, or an empty one of their kind', () => {
  const object = { a: 1 };
  const array = [1];
  expect(objectAt(object)).toBe(object);
  expect(objectAt(array)).toEqual({});
  expect(arrayAt(array)).toBe(array);
  expect(arrayAt(object)).toEqual([]);
});

it('plainJson keeps strings, finite numbers, booleans and null, and makes anything else null', () => {
  for (const value of ['x', 1.5, true, false, null]) expect(plainJson(value)).toBe(value);
  for (const value of [undefined, Number.NaN, Number.POSITIVE_INFINITY, {}, []]) expect(plainJson(value)).toBeNull();
});

it('isCount and dayCount: whole numbers; dayCount only above zero', () => {
  expect([0, 3, -2, 1.5, '3'].map(isCount)).toEqual([true, true, true, false, false]);
  expect([0, 3, -2, 1.5, '3'].map(dayCount)).toEqual([null, 3, null, null, null]);
});

it('jsonPrice reads a number cut to whole HKD, and numeric text only when allowed', () => {
  expect(jsonPrice(6199.9)).toBe(6199);
  expect(jsonPrice(99)).toBeNull();
  expect(jsonPrice(Number.NaN)).toBeNull();
  expect(jsonPrice('2,699')).toBeNull();
  expect(jsonPrice('2,699', true)).toBe(2699);
  expect(jsonPrice(null, true)).toBeNull();
});
