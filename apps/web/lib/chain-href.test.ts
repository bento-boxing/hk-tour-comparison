import { it, expect } from 'vitest';
import { decodeChain, DEFAULT_GAP } from '@hktours/core';
import { chainHref, chainStartHref } from './chain-href';

it('chainStartHref starts a chain with one leg and the default gap', () => {
  expect(chainStartHref('egl:KIX5', '2026-12-18')).toBe('/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3');
});

it('chainHref writes any chain, and decodeChain reads it back', () => {
  const chain = {
    legs: [{ tourKey: 'egl:KIX5', departure: '2026-12-18' }, { tourKey: 'jetour:TYO-KIX', departure: '2026-12-24' }],
    gap: { min: 2, max: 5 },
  };
  const url = new URL(chainHref(chain), 'http://localhost');
  expect(url.pathname).toBe('/chain');
  expect(decodeChain({ legs: url.searchParams.get('legs'), gap: url.searchParams.get('gap') })).toEqual(chain);
});

it('a chain with no legs keeps only the gap', () => {
  expect(chainHref({ legs: [], gap: { ...DEFAULT_GAP } })).toBe('/chain?gap=1-3');
});
