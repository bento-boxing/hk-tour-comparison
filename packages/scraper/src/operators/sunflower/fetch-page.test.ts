import { describe, expect, it } from 'vitest';
import type { Fetcher } from '../../types';
import { bookingUrl } from './discover';
import { createFetchPage, joinPage, splitPage } from './fetch-page';
import { publicBookingPage, publicEntry, type PublicEntry } from './public';
import { rawBookingPage, rawListingRow, SECRETS } from './test-responses';

const TODAY = '2026-11-14';
const PAGE = bookingUrl('KKFE05WR');
const ENTRY = publicEntry(rawListingRow('KKFE05WR'));

function pageFetcher(answer: string | null) {
  const asked: string[] = [];
  const options: unknown[] = [];
  const fetcher: Fetcher = {
    fetchText: async (url, opts) => {
      asked.push(url);
      options.push(opts);
      return answer;
    },
    postJson: async url => { throw new Error(`POSTed ${url}`); },
  };
  return { fetcher, asked, options };
}
const entries = (...list: PublicEntry[]) => (code: string) => list.find(e => e.ItinCode === code);

describe('joinPage and splitPage', () => {
  it('round-trip the run\'s date, the listing entry and the trimmed booking page', () => {
    const joined = { today: TODAY, entry: ENTRY, page: publicBookingPage(rawBookingPage()) };
    expect(splitPage(joinPage(joined))).toEqual(joined);
  });
  it.each(['<html></html>', '[]', '{"today":"2026-11-14","entry":{}}', '{"today":1,"entry":{},"page":""}'])('give null for any other text (%s)', text => {
    expect(splitPage(text)).toBeNull();
  });
});

describe('fetchPage', () => {
  it('requests the booking page once, by GET, and joins it with tonight\'s listing entry and date', async () => {
    const { fetcher, asked, options } = pageFetcher(rawBookingPage());
    const text = await createFetchPage(entries(ENTRY))(fetcher, PAGE, TODAY);
    expect(asked).toEqual([PAGE]);
    expect(options).toEqual([{ sameOriginRedirectsOnly: true }]); // never a redirect off https://www.sunflower.com.hk
    expect(splitPage(text as string)).toEqual({ today: TODAY, entry: ENTRY, page: publicBookingPage(rawBookingPage()) });
  });

  it('keeps none of the page\'s marketing text, promotion notes or scripts', async () => {
    const text = await createFetchPage(entries(ENTRY))(pageFetcher(rawBookingPage()).fetcher, PAGE, TODAY);
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    expect(text).not.toContain('__doPostBack');
  });

  it('gives null, not fetched, when the page gets no answer', async () => {
    expect(await createFetchPage(entries(ENTRY))(pageFetcher(null).fetcher, PAGE, TODAY)).toBeNull();
  });

  it('throws, requesting nothing, for a URL that is not a booking page or a tour not in tonight\'s listing', async () => {
    const { fetcher, asked } = pageFetcher(rawBookingPage());
    await expect(createFetchPage(entries(ENTRY))(fetcher, 'https://www.sunflower.com.hk/tourpdf/KKFE05WR.pdf', TODAY))
      .rejects.toThrow('not a Sunflower booking page');
    await expect(createFetchPage(entries(ENTRY))(fetcher, bookingUrl('CFAG03MK'), TODAY))
      .rejects.toThrow('not in tonight\'s listing');
    expect(asked).toEqual([]);
  });
});

describe('publicBookingPage', () => {
  it('keeps the days tag and the calendar: the month, each cell\'s class and date link, and its price', () => {
    const trimmed = publicBookingPage(rawBookingPage({ cells: [{ date: '20261202', status: '-H', price: '$2,699起' }] }));
    expect(trimmed).toContain('#5天團');
    expect(trimmed).toContain('2026年12月');
    expect(trimmed).toContain('class="Calcell Ava-Calcell-H monthtoday"');
    expect(trimmed).toContain('?date=20261202&amp;TourCode=KKFE05WR');
    expect(trimmed).toContain('<span class="price">$2,699起</span>');
    expect(trimmed).not.toContain('保證成團');
    expect(trimmed).not.toContain('優惠價');
  });
  it('is empty for a page without either', () => {
    expect(publicBookingPage('<html><body>Attention Required! | Cloudflare</body></html>')).toBe('');
  });
});
