import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Fetcher } from '../../types';
import { datesUrl, detailUrl, discover, isTourUrl, LISTING_URL, tourIdOf, tourPageUrl } from './discover';
import { rawListing, rawListingRow, SECRETS } from './test-responses';

const page = (id: number | string) => `https://www.yummyholiday.net/#/pages/detail/detail?id=${id}`;

/** A fetcher that answers the listing with `answer` (a value is sent as JSON) and records what it is asked. */
function listingFetcher(answer: unknown) {
  const asked: string[] = [];
  const fetcher: Fetcher = {
    fetchText: async url => {
      asked.push(url);
      if (url !== LISTING_URL || answer === null) return null;
      return typeof answer === 'string' ? answer : JSON.stringify(answer);
    },
  };
  return { fetcher, asked };
}

describe('the request URLs', () => {
  it('are the three API paths the brief allows, on https://api.yummyholiday.net', () => {
    expect(LISTING_URL).toBe('https://api.yummyholiday.net/bussiness/line/index?limit=500');
    expect(detailUrl('5906')).toBe('https://api.yummyholiday.net/bussiness/line/detail?id=5906');
    expect(datesUrl('5906')).toBe('https://api.yummyholiday.net/bussiness/group/list?line_id=5906');
  });
  it.each(['', '0', '05906', '59 06', '5906&x=1', '1'.repeat(11), '-1'])('refuse an id that is not plain digits (%j)', id => {
    expect(() => detailUrl(id)).toThrow(/not a Yummy Holiday tour id/);
    expect(() => datesUrl(id)).toThrow(/not a Yummy Holiday tour id/);
    expect(() => tourPageUrl(id)).toThrow(/not a Yummy Holiday tour id/);
  });
});

describe('tour pages', () => {
  it('are the site\'s own tour page, the id in its hash route', () => {
    expect(tourPageUrl('5906')).toBe(page(5906));
    expect(tourIdOf(page(5906))).toBe('5906');
    expect(isTourUrl(page(5662))).toBe(true);
  });
  it.each([
    ['another host', 'https://api.yummyholiday.net/#/pages/detail/detail?id=5906'],
    ['http', 'http://www.yummyholiday.net/#/pages/detail/detail?id=5906'],
    ['another route', 'https://www.yummyholiday.net/#/pages/content/content?id=7'],
    ['a second parameter', 'https://www.yummyholiday.net/#/pages/detail/detail?id=5906&code=x'],
    ['an id with a leading zero', 'https://www.yummyholiday.net/#/pages/detail/detail?id=05906'],
    ['no id', 'https://www.yummyholiday.net/#/pages/detail/detail?id='],
    ['the API detail', 'https://api.yummyholiday.net/bussiness/line/detail?id=5906'],
  ])('are not %s', (_name, url) => {
    expect(tourIdOf(url)).toBeNull();
    expect(isTourUrl(url)).toBe(false);
  });
});

const readFixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('discover', () => {
  it('reads the trimmed listing fixture to its hand-checked tour pages', async () => {
    const expected = JSON.parse(readFixture('listing.expected.json')) as { sourceUrl: string; verifiedByOwner: boolean; discovered: string[] };
    expect(expected.sourceUrl).toBe(LISTING_URL);
    expect(expected.verifiedByOwner).toBe(false);
    expect(await discover(listingFetcher(readFixture('listing.api.json')).fetcher)).toEqual(expected.discovered);
  });
  it('reads the listing once and gives each row\'s tour page, in the listing\'s order', async () => {
    const { fetcher, asked } = listingFetcher(rawListing([rawListingRow(6212), rawListingRow(5906), rawListingRow(5662)]));
    expect(await discover(fetcher)).toEqual([page(6212), page(5906), page(5662)]);
    expect(asked).toEqual([LISTING_URL]);
  });
  it('fails, rather than reading part of the list, when the listing has more than one page', async () => {
    const { fetcher, asked } = listingFetcher(rawListing([rawListingRow(5906)], { last_page: 2 }));
    await expect(discover(fetcher)).rejects.toThrow(/2 pages/);
    expect(asked).toEqual([LISTING_URL]); // the second page is not requested
  });
  it.each([
    ['fewer rows than the total', [rawListingRow(5906)], { total: 327 }, /holds 1 rows, but says it has 327/],
    ['more rows than the total', [rawListingRow(5906), rawListingRow(5907)], { total: 1 }, /holds 2 rows, but says it has 1/],
  ])('fails when the listing holds %s', async (_name, rows, patch, reason) => {
    await expect(discover(listingFetcher(rawListing(rows, patch)).fetcher)).rejects.toThrow(reason);
  });
  it.each([
    ['not fetched', null, /not fetched/],
    ['not JSON', '<html>blocked</html>', /not JSON/],
    ['an error code', { code: 0, msg: SECRETS[0] }, /code 0/],
    ['no rows', { code: 1, data: { total: 0, last_page: 1 } }, /no list of tours/],
    ['no total', rawListing([rawListingRow(5906)], { total: '1' }), /no tour count/],
    ['no page count', rawListing([rawListingRow(5906)], { last_page: null }), /pages/],
    ['a row without a tour id', rawListing([rawListingRow(5906), rawListingRow(0)]), /a row without a tour id/],
    ['a row whose id is text', rawListing([rawListingRow(5906), { ...rawListingRow(1), id: '5907' }]), /a row without a tour id/],
  ])('fails when the listing is %s, without the answer\'s text in the reason', async (_name, answer, reason) => {
    const failure = discover(listingFetcher(answer).fetcher);
    await expect(failure).rejects.toThrow(reason);
    await expect(failure).rejects.toThrow(/^yummy: /);
    await failure.catch(error => {
      for (const secret of SECRETS) expect((error as Error).message).not.toContain(secret);
    });
  });
  it('lists a tour the listing repeats once', async () => {
    const { fetcher } = listingFetcher(rawListing([rawListingRow(5906), rawListingRow(5906)]));
    expect(await discover(fetcher)).toEqual([page(5906)]);
  });
});
