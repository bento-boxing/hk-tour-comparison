import { it, expect } from 'vitest';
import { encodeChain, decodeChain, MAX_CHAIN_LEGS, TOUR_CODE_PATTERN } from './index';

const state = {
  legs: [{ tourKey: 'egl:HTBKOK06', departure: '2026-12-18' }, { tourKey: 'jetour:THB', departure: '2026-12-24' }],
  gap: { min: 1, max: 3 },
};
it('encodes', () => {
  expect(encodeChain(state)).toEqual({ legs: 'egl:HTBKOK06@2026-12-18,jetour:THB@2026-12-24', gap: '1-3' });
});
it('round-trips', () => { expect(decodeChain(encodeChain(state))).toEqual(state); });
it('omits legs when empty', () => { expect(encodeChain({ legs: [], gap: { min: 0, max: 2 } })).toEqual({ gap: '0-2' }); });
it('decodes nothing into an empty chain with the default gap', () => {
  expect(decodeChain({})).toEqual({ legs: [], gap: { min: 1, max: 3 } });
  expect(decodeChain({ legs: null, gap: null })).toEqual({ legs: [], gap: { min: 1, max: 3 } });
});
it.each([
  ['unknown operator', 'wingon:X1@2026-12-18'],
  ['bad date', 'egl:X1@2026-02-30'],
  ['no date', 'egl:X1'],
  ['empty code', 'egl:@2026-12-18'],
  ['script injection', 'egl:<script>@2026-12-18'],
  ['garbage', '%%%'],
])('drops an invalid leg (%s)', (_n, legs) => { expect(decodeChain({ legs }).legs).toEqual([]); });
it('accepts a leg of every operator, Charming Holidays included', () => {
  expect(decodeChain({ legs: 'charming:GERE@2026-12-19,bigline:T1@2027-01-02' }).legs).toEqual([
    { tourKey: 'charming:GERE', departure: '2026-12-19' }, { tourKey: 'bigline:T1', departure: '2027-01-02' },
  ]);
});
it('keeps legs before the first invalid one and drops the rest', () => {
  expect(decodeChain({ legs: 'egl:A@2026-12-18,bad,jetour:B@2026-12-30' }).legs)
    .toEqual([{ tourKey: 'egl:A', departure: '2026-12-18' }]);
});
it.each([['5-1', 1, 5], ['-2-3', 1, 3], ['abc', 1, 3], ['0-99', 0, 30], ['2', 1, 3], ['', 1, 3]])(
  'gap %j → %i–%i', (gap, min, max) => { expect(decodeChain({ gap }).gap).toEqual({ min, max }); });
it('caps the number of legs', () => {
  const many = Array.from({ length: 12 }, (_, i) => `egl:T${i}@2027-01-${String(i + 1).padStart(2, '0')}`).join(',');
  expect(decodeChain({ legs: many }).legs.length).toBe(8);
});

// Beyond the brief: edges of the code rule and other hand-edited input.
it('accepts a 40-character code of every allowed character class and rejects 41', () => {
  const code40 = 'Az09_-'.repeat(6) + 'abcd';
  expect(decodeChain({ legs: `texpert:${code40}@2026-12-18` }).legs)
    .toEqual([{ tourKey: `texpert:${code40}`, departure: '2026-12-18' }]);
  expect(decodeChain({ legs: `texpert:${code40}x@2026-12-18` }).legs).toEqual([]);
});
it.each([
  ['empty string', ''],
  ['space in code', 'egl:A B@2026-12-18'],
  ['upper-case operator', 'EGL:A@2026-12-18'],
  ['extra @', 'egl:A@2026-12-18@2026-12-19'],
  ['date with time', 'egl:A@2026-12-18T00:00'],
])('rejects a malformed leg (%s)', (_n, legs) => { expect(decodeChain({ legs }).legs).toEqual([]); });
it('a trailing comma ends the chain after the valid legs', () => {
  expect(decodeChain({ legs: 'egl:A@2026-12-18,' }).legs).toEqual([{ tourKey: 'egl:A', departure: '2026-12-18' }]);
});
it('keeps exactly MAX_CHAIN_LEGS legs, in order', () => {
  expect(MAX_CHAIN_LEGS).toBe(8);
  const many = Array.from({ length: 9 }, (_, i) => `bigline:T${i}@2027-01-0${i + 1}`).join(',');
  expect(decodeChain({ legs: many }).legs.map((l) => l.tourKey))
    .toEqual(['bigline:T0', 'bigline:T1', 'bigline:T2', 'bigline:T3', 'bigline:T4', 'bigline:T5', 'bigline:T6', 'bigline:T7']);
});
it('gives the default gap when a number is too large to be finite', () => {
  expect(decodeChain({ gap: `1-${'9'.repeat(400)}` }).gap).toEqual({ min: 1, max: 3 });
});
it('never throws on input of the wrong type', () => {
  const odd = { legs: ['egl:A@2026-12-18'], gap: 5 } as unknown as { legs: string; gap: string };
  expect(decodeChain(odd)).toEqual({ legs: [], gap: { min: 1, max: 3 } });
});
it('returns a fresh default gap object each time', () => {
  const a = decodeChain({});
  a.gap.min = 9;
  expect(decodeChain({}).gap).toEqual({ min: 1, max: 3 });
});
it('accepts a leg exactly when its code is one the tour schema accepts (one shared pattern)', () => {
  const codes = ['CZZMEDNC_26346_JJ', 'TUNB-1', 'EIMz', 'A'.repeat(40), 'A'.repeat(41), 'TH B', 'TH/B', 'THB東', 'TH.B', ''];
  for (const code of codes) {
    const decoded = decodeChain({ legs: `egl:${code}@2026-12-18` }).legs;
    expect(decoded.length === 1, code).toBe(TOUR_CODE_PATTERN.test(code));
    if (decoded.length === 1) expect(decoded[0].tourKey).toBe(`egl:${code}`);
  }
});
