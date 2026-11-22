import { describe, it, expect } from 'vitest';
import { places } from '@hktours/core';
import type { DestinationCounts } from '@hktours/db/read';
import { POPULAR_COUNT, screenData } from './search-screen';

// Task 73: what the phone search screen is told besides the places data.

const line = (countryId: string, regionId: string | null, tours: number) => ({ countryId, regionId, tours, operators: 1 });
const site: DestinationCounts = {
  all: { tours: 900, operators: 6 },
  destinations: [
    line('china', null, 300), line('china', 'china-guangdong', 200), line('japan', null, 150), line('japan', 'japan-kansai', 40),
    line('korea', null, 100), line('taiwan', null, 90), line('thailand', null, 80), line('vietnam', null, 70),
    line('malaysia', null, 60), line('germany', null, 50), line('france', null, 40), line('italy', null, 30),
  ],
};

describe('screenData', () => {
  it('the eight countries with the most tours, site-wide; counts by destination id from the given context', () => {
    const season: DestinationCounts = { all: { tours: 5, operators: 1 }, destinations: [line('japan', null, 5), line('japan', 'japan-kansai', 2)] };
    const data = screenData(site, season, places);
    expect(POPULAR_COUNT).toBe(8);
    expect(data.popular).toEqual(['china', 'japan', 'korea', 'taiwan', 'thailand', 'vietnam', 'malaysia', 'germany']);
    expect(data.tours).toEqual({ japan: 5, 'japan-kansai': 2 });
  });

  it('no context (an operator\'s page): the popular ones, no counts', () => {
    expect(screenData(site, null, places)).toEqual({ popular: screenData(site, site, places).popular, tours: null });
  });
});
