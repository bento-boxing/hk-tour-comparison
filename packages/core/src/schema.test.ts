import { describe, it, expect } from 'vitest';
import { scrapedTourSchema, parsePriceHkd, isIsoDate, TOUR_CODE_PATTERN } from './schema';
import type { ScrapedTour } from './types';

const valid: ScrapedTour = {
  operatorId: 'jetour', code: 'THB', url: 'https://www.jetour.com.hk/tour/THB',
  title: '曼谷芭堤雅5天', days: 5, nights: 4,
  dayHeadings: ['香港 → 曼谷', '曼谷 → 芭堤雅'],
  startPoint: null, endPoint: null, fromPriceHkd: 3999,
  departures: [{ date: '2026-12-22', priceHkd: 4299 }],
};

describe('scrapedTourSchema', () => {
  it('accepts a valid tour', () => { expect(scrapedTourSchema.safeParse(valid).success).toBe(true); });

  it.each([
    ['empty code', { code: '' }],
    ['unknown operator', { operatorId: 'wingon' }],
    ['non-https url', { url: 'http://x.com/a' }],
    ['zero days', { days: 0 }],
    ['61 days', { days: 61 }],
    ['fractional days', { days: 4.5 }],
    ['bad date', { departures: [{ date: '2026-02-30', priceHkd: 1 }] }],
    ['date wrong shape', { departures: [{ date: '22/12/2026', priceHkd: 1 }] }],
    ['price under 100', { fromPriceHkd: 50 }],
    ['fractional price', { fromPriceHkd: 3999.5 }],
  ])('rejects %s', (_n, patch) => {
    expect(scrapedTourSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  // A tour's code travels in the chain page's address (chain-url.ts), so the schema accepts only codes
  // that decodeChain can carry: anything else is a parse failure here instead of a link that decodes to nothing.
  it.each([
    ['a space', 'TH B'], ['a slash', 'TH/B'], ['a Chinese character', 'THB東'], ['41 characters', 'A'.repeat(41)],
    ['an @', 'THB@1'], ['a colon', 'egl:THB'], ['a comma', 'THB,1'],
  ])('rejects a code with %s', (_n, code) => {
    expect(scrapedTourSchema.safeParse({ ...valid, code }).success).toBe(false);
  });

  it.each(['CZZMEDNC_26346_JJ', 'TUNB-1', 'EIMz', 'A'.repeat(40), '0'])('accepts the code %s', (code) => {
    expect(scrapedTourSchema.safeParse({ ...valid, code }).success).toBe(true);
    expect(TOUR_CODE_PATTERN.test(code)).toBe(true);
  });

  // The 'bad date' case above also has an out-of-range price; this pins the date rule on its own.
  it('rejects an impossible departure date even when its price is valid', () => {
    expect(scrapedTourSchema.safeParse({ ...valid, departures: [{ date: '2026-02-30', priceHkd: 4299 }] }).success).toBe(false);
  });

  it('accepts empty departures and empty dayHeadings (rejected later, in normalise)', () => {
    expect(scrapedTourSchema.safeParse({ ...valid, departures: [], dayHeadings: [] }).success).toBe(true);
  });
});

describe('parsePriceHkd', () => {
  it.each([
    ['HK$7,999起', 7999], ['$7999+', 7999], ['7,999 元', 7999], ['HKD 12,500', 12500],
    ['港幣 8999 起', 8999], [' HK$ 3,980 ', 3980],
    ['', null], ['待定', null], ['0', null], ['HK$99', null], ['HK$1,234.50', 1234],
  ])('parsePriceHkd(%j) → %j', (text, expected) => { expect(parsePriceHkd(text)).toBe(expected); });
});

describe('isIsoDate', () => {
  it('isIsoDate', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2026-1-5')).toBe(false);
  });
});
