import { expect, it } from 'vitest';
import {
  collapseWhitespace, collapseWhitespaceNfc, collapseWhitespaceWithoutZeroWidth, jsonText, withoutQueryOrFragment,
} from './text';

const COMPATIBILITY = '\uF9F6'; // a CJK compatibility ideograph
const ORDINARY = '\u81E8'; // its NFC form
const ZERO_WIDTH = '\u200B';

it('collapseWhitespace makes every run of whitespace, no-break spaces and line breaks included, one space, and trims', () => {
  expect(collapseWhitespace(' 東京\u00A0\u00A0大阪\n\t京都 ')).toBe('東京 大阪 京都');
  expect(collapseWhitespace(`東${ZERO_WIDTH}京`)).toBe(`東${ZERO_WIDTH}京`);
  expect(collapseWhitespace(COMPATIBILITY)).toBe(COMPATIBILITY);
});

it('jsonText collapses a string and gives an empty text for anything else', () => {
  expect(jsonText('  A\n B ')).toBe('A B');
  for (const value of [null, undefined, 5, true, {}, ['x']]) expect(jsonText(value)).toBe('');
});

it('collapseWhitespaceWithoutZeroWidth also removes zero-width characters', () => {
  expect(collapseWhitespaceWithoutZeroWidth(`\uFEFF東${ZERO_WIDTH}京 \u200C 大阪\u200D`)).toBe('東京 大阪');
});

it('collapseWhitespaceNfc also gives compatibility ideographs as their ordinary characters', () => {
  expect(collapseWhitespaceNfc(` ${COMPATIBILITY}  x `)).toBe(`${ORDINARY} x`);
  expect(collapseWhitespaceNfc(`a${ZERO_WIDTH}b`)).toBe(`a${ZERO_WIDTH}b`);
});

it('withoutQueryOrFragment cuts the URL at its first ? or #', () => {
  expect(withoutQueryOrFragment('https://x.test/tour/A?b=1#c')).toBe('https://x.test/tour/A');
  expect(withoutQueryOrFragment('https://x.test/tour/A#c?b')).toBe('https://x.test/tour/A');
  expect(withoutQueryOrFragment('https://x.test/tour/A')).toBe('https://x.test/tour/A');
});
