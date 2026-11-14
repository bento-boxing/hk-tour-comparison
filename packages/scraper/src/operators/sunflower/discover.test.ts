import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Fetcher } from '../../types';
import { bookingUrl, codeOf, isTourUrl, LISTING_URL, readListing } from './discover';
import { rawListing, rawListingRow, SECRETS } from './test-responses';

const page = (code: string) => `https://www.sunflower.com.hk/OnlineBooking/?TourCode=${code}`;

describe('the request URLs', () => {
  it('are the two paths the brief allows, on https://www.sunflower.com.hk', () => {
    expect(LISTING_URL).toBe('https://www.sunflower.com.hk/App/Tour/Get?Region=&Area=&Subarea=&keyword=');
    expect(bookingUrl('KKFE05WR')).toBe('https://www.sunflower.com.hk/OnlineBooking/?TourCode=KKFE05WR');
  });
  it.each(['', 'KKFE 05', 'KKFE05WR&date=20270115', 'KK-FE', 'é', 'A'.repeat(41)])('refuse a code that is not plain letters and digits (%j)', code => {
    expect(() => bookingUrl(code)).toThrow(/not a Sunflower tour code/);
  });
});

describe('tour pages', () => {
  it('are the booking page, which is also the tour\'s identity', () => {
    expect(codeOf(page('KKFE05WR'))).toBe('KKFE05WR');
    expect(isTourUrl(page('CFAG03MK'))).toBe(true);
  });
  it.each([
    'http://www.sunflower.com.hk/OnlineBooking/?TourCode=KKFE05WR',
    'https://www.sunflower.com.hk/OnlineBooking?TourCode=KKFE05WR',
    'https://www.sunflower.com.hk/OnlineBooking/?date=20270115&TourCode=KKFE05WR',
    'https://www.sunflower.com.hk/OnlineBooking/?TourCode=KKFE05WR#ancPaxSelection',
    'https://www.sunflower.com.hk/tourpdf/KKFE05WR.pdf',
  ])('anything else is not one (%s)', url => {
    expect(codeOf(url)).toBeNull();
    expect(isTourUrl(url)).toBe(false);
  });
});

describe('readListing', () => {
  it('keeps the entries with an online booking code, in the listing\'s order, and counts the others by region', () => {
    const listing = readListing(JSON.stringify(rawListing([
      rawListingRow('KKFE05WR'),
      rawListingRow('', { region: '郵輪' }),
      rawListingRow('CFAG03MK', { region: '中國短線' }),
      rawListingRow('  ', { region: '郵輪' }),
      rawListingRow('', { region: '包團' }),
      rawListingRow('KKFE05WR', { Title: 'a second entry with the same code' }),
    ])));
    expect(listing.tours.map(t => t.ItinCode)).toEqual(['KKFE05WR', 'CFAG03MK']);
    expect(listing.tours[0].Title).toBe('暢遊冬日秘境釜山慶州食足13餐五天團'); // the first of a repeated code
    expect(listing.leftOut).toEqual([['郵輪', 2], ['包團', 1]]);
    expect(listing.repeated).toEqual(['KKFE05WR']);
  });

  it('keeps only the public facts the parser reads', () => {
    const listing = readListing(JSON.stringify(rawListing([rawListingRow('KKFE05WR')])));
    expect(listing.tours[0]).toEqual({
      ItinCode: 'KKFE05WR', Title: '暢遊冬日秘境釜山慶州食足13餐五天團', region: '日韓', area: '韓國', subarea: '釜山、慶州',
      minprice: 3299, discount: 2699, discounttext: '2,699', tdp_confirm: '4/12,11/12', tdp_hardpush: '2/12,6/1...',
    });
    for (const secret of SECRETS) expect(JSON.stringify(listing)).not.toContain(secret);
  });

  it.each([
    ['not JSON', '<html>blocked</html>', 'sunflower: the listing is not JSON'],
    ['status false', JSON.stringify({ status: false, data: [] }), 'sunflower: the listing did not answer status true'],
    ['no data list', JSON.stringify({ status: true }), 'sunflower: the listing has no list of entries'],
    ['no tour', JSON.stringify(rawListing([rawListingRow('', { region: '郵輪' })])), 'sunflower: the listing has no entry with an online booking code'],
    ['a code that is not plain', JSON.stringify(rawListing([rawListingRow('KKFE05WR'), rawListingRow('KK FE')])), 'sunflower: the listing has a booking code that is not plain letters and digits'],
  ])('throws, with a fixed text, for %s', (_, text, why) => {
    expect(() => readListing(text)).toThrow(why);
  });
});

describe('the listing fixture', () => {
  const expected = JSON.parse(readFileSync(new URL('./fixtures/listing.expected.json', import.meta.url), 'utf8'));
  const listing = readListing(readFileSync(new URL('./fixtures/listing.json', import.meta.url), 'utf8'));
  it('gives the hand-checked booking pages and left-out counts', () => {
    expect(listing.tours.map(t => bookingUrl(t.ItinCode))).toEqual(expected.discovered);
    expect(listing.leftOut).toEqual(expected.leftOut);
    expect(expected.verifiedByOwner).toBe(false);
  });
});

/** A fetcher that answers the listing with `answer` and records what it is asked. */
function listingFetcher(answer: string | null) {
  const asked: string[] = [];
  const fetcher: Fetcher = {
    fetchText: async url => {
      asked.push(url);
      return url === LISTING_URL ? answer : null;
    },
  };
  return { fetcher, asked };
}

describe('discovery (through the scraper)', () => {
  it('requests the listing once and returns each tour\'s booking page, logging what it left out', async () => {
    const { createSunflowerScraper } = await import('./index');
    const logs: string[] = [];
    const scraper = createSunflowerScraper({ log: line => logs.push(line) });
    const { fetcher, asked } = listingFetcher(JSON.stringify(rawListing([
      rawListingRow('KKFE05WR'), rawListingRow('', { region: '郵輪' }), rawListingRow('CFAG03MK'),
    ])));
    expect(await scraper.discover(fetcher)).toEqual([page('KKFE05WR'), page('CFAG03MK')]);
    expect(asked).toEqual([LISTING_URL]);
    expect(logs).toEqual(['sunflower: left out 1 listing entry without an online booking code (郵輪 1)']);
  });

  it('throws when the listing is not fetched', async () => {
    const { createSunflowerScraper } = await import('./index');
    const scraper = createSunflowerScraper({ log: () => {} });
    await expect(scraper.discover(listingFetcher(null).fetcher)).rejects.toThrow('sunflower: the listing was not fetched');
  });
});
