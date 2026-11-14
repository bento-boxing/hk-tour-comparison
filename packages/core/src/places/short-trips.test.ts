import { describe, it, expect } from 'vitest';
import { places } from './index';
import { SHORT_TRIP_MAX_DAYS, SHORT_TRIP_REGION_IDS } from './short-trips';

describe('the short-trip regions (a fallback route\'s "too far for the trip" rule)', () => {
  it('every id is a region in the places data', () => {
    expect(SHORT_TRIP_REGION_IDS.filter(id => places.region(id) === undefined)).toEqual([]);
  });
  it('lists each region once', () => {
    expect(new Set(SHORT_TRIP_REGION_IDS).size).toBe(SHORT_TRIP_REGION_IDS.length);
  });
  it('applies to tours of up to 3 days', () => {
    expect(SHORT_TRIP_MAX_DAYS).toBe(3);
  });
});
