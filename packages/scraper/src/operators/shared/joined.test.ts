import type { ScrapedTour } from '@hktours/core';
import { expect, it } from 'vitest';
import { joinJson, splitJson, tourOrNull, tourOrThrow } from './joined';

it('joinJson writes the parts as JSON, and splitJson gives them to the reader', () => {
  const text = joinJson({ page: '<p>x</p>', dates: [1] });
  expect(text).toBe('{"page":"<p>x</p>","dates":[1]}');
  expect(splitJson(text, value => value)).toEqual({ page: '<p>x</p>', dates: [1] });
  expect(splitJson(text, () => null)).toBeNull();
});

it('splitJson gives null, without calling the reader, for text that is not a JSON object', () => {
  const read = (): string => { throw new Error('not called'); };
  for (const text of ['', 'not json', '[]', '[{"page":"x"}]', 'null', '"x"', '1']) expect(splitJson(text, read)).toBeNull();
});

it('tourOrNull and tourOrThrow pass a tour through and turn a reason into null or an error', () => {
  const tour = { code: 'A' } as ScrapedTour;
  expect(tourOrNull(tour)).toBe(tour);
  expect(tourOrThrow(tour)).toBe(tour);
  expect(tourOrNull({ why: 'no code' })).toBeNull();
  expect(() => tourOrThrow({ why: 'no code' })).toThrow(new Error('no code'));
});
