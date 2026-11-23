import { describe, expect, it } from 'vitest';
import { normaliseName, places } from './places/index';
import { cityNameKeys, perIndex } from './per-index';

describe('perIndex', () => {
  it('builds once per index, and again for another index object', () => {
    let builds = 0;
    const count = perIndex(index => { builds++; return index.data.cities.length; });
    expect(count(places)).toBe(places.data.cities.length);
    expect(count(places)).toBe(places.data.cities.length);
    expect(builds).toBe(1);
    const fewer = { ...places, data: { ...places.data, cities: places.data.cities.slice(0, 3) } };
    expect(count(fewer)).toBe(3);
    expect(builds).toBe(2);
  });

  it('remembers a result that is undefined too', () => {
    let builds = 0;
    const nothing = perIndex(() => { builds++; return undefined; });
    nothing(places);
    nothing(places);
    expect(builds).toBe(1);
  });
});

it('cityNameKeys: every city in data order, with its own names normalised, of 2 characters or more', () => {
  const keys = cityNameKeys(places);
  expect(keys.map(city => city.id)).toEqual(places.data.cities.map(city => city.id));
  places.data.cities.forEach((city, i) => {
    expect(keys[i]!.keys).toEqual([city.nameZh, ...city.aliases].map(normaliseName).filter(key => [...key].length >= 2));
  });
});
