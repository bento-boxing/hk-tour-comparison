import { describe, it, expect } from 'vitest';
import { first, readerOf, type RawParams } from './raw-params';

describe('first: the first value of an address parameter, when it is a string at all', () => {
  it('gives a single value as it is, the empty text too', () => {
    expect(first({ t: 'egl:KIX5' }, 't')).toBe('egl:KIX5');
    expect(first({ t: '' }, 't')).toBe('');
  });

  it('gives the first of a repeated parameter', () => {
    expect(first({ t: ['a', 'b'] }, 't')).toBe('a');
    expect(first({ t: [] }, 't')).toBeUndefined();
  });

  it('gives undefined for a missing name, an undefined value, and anything that is not a string', () => {
    expect(first({}, 't')).toBeUndefined();
    expect(first({ t: undefined }, 't')).toBeUndefined();
    expect(first({ t: 5 } as unknown as RawParams, 't')).toBeUndefined();
    expect(first({ t: [5, 'b'] } as unknown as RawParams, 't')).toBeUndefined();
  });

  it('reads only the address\'s own names, never one inherited from an object\'s prototype', () => {
    expect(first(Object.create({ t: 'inherited' }) as RawParams, 't')).toBeUndefined();
    expect(first({}, 'constructor')).toBeUndefined();
    expect(first({}, 'toString')).toBeUndefined();
    expect(first({}, '__proto__')).toBeUndefined();
  });
});

describe('readerOf: first, for a fixed list of names only', () => {
  it('reads as first does, and the compiler refuses any other name (pnpm typecheck checks the expected error)', () => {
    const read = readerOf<'dmin' | 'dmax'>();
    expect(read({ dmin: ['5', '6'] }, 'dmin')).toBe('5');
    expect(read(Object.create({ dmax: '9' }) as RawParams, 'dmax')).toBeUndefined();
    // @ts-expect-error: 'order' is not one of the reader's names.
    expect(read({ order: 'x' }, 'order')).toBe('x');
  });
});
