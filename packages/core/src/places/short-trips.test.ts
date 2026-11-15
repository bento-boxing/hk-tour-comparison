import { describe, it, expect } from 'vitest';
import { places } from './index';
import { SHORT_TRIP_MAX_DAYS, SHORT_TRIP_REGION_IDS, SHORT_TRIP_REGION_IDS_WITHOUT_CHINA } from './short-trips';

describe('the short-trip regions (a fallback route\'s "too far for the trip" rule)', () => {
  it('every id is a region in the places data', () => {
    expect(SHORT_TRIP_REGION_IDS.filter(id => places.region(id) === undefined)).toEqual([]);
  });
  it('lists each region once', () => {
    expect(new Set(SHORT_TRIP_REGION_IDS).size).toBe(SHORT_TRIP_REGION_IDS.length);
  });
  it('the regions kept only without a China-group stop are short-trip regions (Seoul, Busan)', () => {
    expect(SHORT_TRIP_REGION_IDS_WITHOUT_CHINA.filter(id => !SHORT_TRIP_REGION_IDS.includes(id))).toEqual([]);
    expect(SHORT_TRIP_REGION_IDS_WITHOUT_CHINA.map(id => places.region(id)?.countryId)).toEqual(['korea', 'korea']);
  });
  it('of the provinces that were 華中, holds only 江西, the one seen on tours of 2 or 3 days (task 37)', () => {
    expect(SHORT_TRIP_REGION_IDS.filter(id => ['china-hubei', 'china-henan', 'china-jiangxi', 'china-central'].includes(id)))
      .toEqual(['china-jiangxi']);
  });
  it('holds none of the provinces and areas the five grouped regions became, as it held none of the groups (task 40)', () => {
    const split = places.regionsOf('china').filter(r => r.members !== undefined || places.citiesOf(r.id).some(c =>
      /^china-(beijing|shanghai|sichuan|northeast|northwest)-/.test(c.id))).map(r => r.id);
    expect(split).toHaveLength(19);
    expect(SHORT_TRIP_REGION_IDS.filter(id => split.includes(id))).toEqual([]);
  });
  it('applies to tours of up to 3 days', () => {
    expect(SHORT_TRIP_MAX_DAYS).toBe(3);
  });
});
