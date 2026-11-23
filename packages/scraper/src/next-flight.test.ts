import { expect, it } from 'vitest';
import { FLIGHT_CHUNK } from './next-flight';

it('captures the JSON string literal of one whole flight data script', () => {
  expect(FLIGHT_CHUNK.exec(' self.__next_f.push([1,"a\\"b\\\\c\\n"]); ')?.[1]).toBe('"a\\"b\\\\c\\n"');
  // A backslash before a raw line break counts as an escape too, as the `s` flag gave the parser's older copy.
  expect(FLIGHT_CHUNK.exec('self.__next_f.push([1,"a\\\nb"])')?.[1]).toBe('"a\\\nb"');
});

it('matches nothing else', () => {
  expect(FLIGHT_CHUNK.test('self.__next_f.push([0,"a"])')).toBe(false);
  expect(FLIGHT_CHUNK.test('self.__next_f.push([1,"a"]); x()')).toBe(false);
  expect(FLIGHT_CHUNK.test('self.__next_f.push([1,"a"b"])')).toBe(false);
});
