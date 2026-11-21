import { it, expect } from 'vitest';
import { OPERATOR_IDS } from '@hktours/core';
import { isTourKey, parseSavedKeys, savedHref, SAVED_CAP } from './saved-list';

it('a tour key is a known operator and a valid tour code', () => {
  for (const key of ['egl:KIX5', 'jetour:THB', 'sunflower:A_1-b', `taste:${'X'.repeat(40)}`]) expect(isTourKey(key), key).toBe(true);
  for (const key of ['', 'egl', 'egl:', ':KIX5', 'nobody:KIX5', 'EGL:KIX5', 'egl:KIX 5', 'egl:KIX5@2026-12-18', `egl:${'X'.repeat(41)}`,
    'egl:KIX5,jetour:THB', 'egl:日本', 'egl:KIX5\n', 42, null, undefined, ['egl:KIX5']]) {
    expect(isTourKey(key), JSON.stringify(key)).toBe(false);
  }
});

it('the saved page\'s address: /saved for none; the keys in the given order, comma-separated, in `t`', () => {
  expect(savedHref([])).toBe('/saved');
  expect(savedHref(['egl:KIX5', 'jetour:THB'])).toBe('/saved?t=egl%3AKIX5%2Cjetour%3ATHB');
  expect(parseSavedKeys(Object.fromEntries(new URLSearchParams(savedHref(['egl:KIX5', 'jetour:THB']).split('?')[1])))).toEqual({
    keys: ['egl:KIX5', 'jetour:THB'], dropped: 0,
  });
});

it(`the longest address: ${SAVED_CAP} keys of the longest operator id and a 40-character code, about 5,500 characters`, () => {
  const longest = [...OPERATOR_IDS].sort((a, b) => b.length - a.length)[0];
  const keys = Array.from({ length: SAVED_CAP }, (_, i) => `${longest}:${String(i).padStart(40, 'X')}`);
  const href = savedHref(keys);
  expect(href.length).toBeLessThanOrEqual(5600);
  expect(`/zh-hans${href}`.length).toBeLessThan(8 * 1024); // under the 8 KB that the strictest servers and proxies accept
  expect(parseSavedKeys({ t: decodeURIComponent(href.split('t=')[1]) }).keys).toEqual(keys);
});

it('reads the keys in the address\'s order, each once; anything unreadable is left out and counted', () => {
  expect(parseSavedKeys({ t: 'jetour:THB,egl:KIX5' })).toEqual({ keys: ['jetour:THB', 'egl:KIX5'], dropped: 0 });
  expect(parseSavedKeys({ t: 'egl:KIX5,garbage,egl:KIX5,,nobody:X,jetour:THB,' })).toEqual({ keys: ['egl:KIX5', 'jetour:THB'], dropped: 3 });
  expect(parseSavedKeys({ t: '<script>' })).toEqual({ keys: [], dropped: 1 });
});

it('no `t`, an empty one, or one that is not text: no keys and nothing dropped', () => {
  expect(parseSavedKeys({})).toEqual({ keys: [], dropped: 0 });
  expect(parseSavedKeys({ t: '' })).toEqual({ keys: [], dropped: 0 });
  expect(parseSavedKeys({ t: undefined })).toEqual({ keys: [], dropped: 0 });
  // Only the first `t` counts, as with every other parameter.
  expect(parseSavedKeys({ t: ['egl:KIX5', 'jetour:THB'] })).toEqual({ keys: ['egl:KIX5'], dropped: 0 });
  // An inherited property is not a parameter.
  expect(parseSavedKeys(Object.create({ t: 'egl:KIX5' }))).toEqual({ keys: [], dropped: 0 });
});

it(`at most ${SAVED_CAP} keys, whatever the address holds; the rest are counted as dropped`, () => {
  const many = Array.from({ length: SAVED_CAP + 30 }, (_, i) => `egl:T${i}`);
  const { keys, dropped } = parseSavedKeys({ t: many.join(',') });
  expect(keys).toEqual(many.slice(0, SAVED_CAP));
  expect(dropped).toBe(30);
});

it('a huge hand-made address is bounded: only its first parts are looked at', () => {
  const junk = Array.from({ length: 5000 }, () => 'x').join(',');
  const { keys, dropped } = parseSavedKeys({ t: `${junk},egl:KIX5` });
  expect(keys).toEqual([]);
  expect(dropped).toBe(5001);
});
