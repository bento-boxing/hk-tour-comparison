import type { IsoDate } from '@hktours/core';
import type { Fetcher } from '../../types';
import { isObject } from '../shared/json';
import { joinJson, splitJson } from '../shared/joined';
import { bookingUrl, codeOf, SAME_SITE } from './discover';
import { publicBookingPage, type PublicEntry } from './public';

/**
 * What `parse` reads for one tour: the run's date (Hong Kong; the listing's later dates have no year), the tour's
 * listing entry and its trimmed booking page.
 */
export interface TourPage { today: IsoDate; entry: PublicEntry; page: string }

export function joinPage(tour: TourPage): string {
  return joinJson(tour);
}

/** The parts of a joinPage text (or a fixture written as one); null for any other text. */
export function splitPage(text: string): TourPage | null {
  return splitJson(text, value => (typeof value.today === 'string' && isObject(value.entry) && typeof value.page === 'string'
    ? value as unknown as TourPage : null));
}

/**
 * Sunflower's fetchPage: the tour's booking page, one plain GET through the run's fetcher (which spaces, checks and
 * logs every request; a redirect off https://www.sunflower.com.hk is refused: not fetched), joined with the tour's entry from tonight's listing (`entryOf`, filled by discovery) and
 * the run's date. Only the public facts (public.ts) are kept. null, not fetched, when the page gets no answer. It
 * throws, requesting nothing, for a URL that is not a booking page or a code tonight's listing does not hold.
 */
export function createFetchPage(
  entryOf: (code: string) => PublicEntry | undefined,
): (fetcher: Fetcher, url: string, today: IsoDate) => Promise<string | null> {
  return async (fetcher, url, today) => {
    const code = codeOf(url);
    if (code === null) throw new Error('not a Sunflower booking page');
    const entry = entryOf(code);
    if (entry === undefined) throw new Error('not in tonight\'s listing');
    const html = await fetcher.fetchText(bookingUrl(code), SAME_SITE);
    if (html === null) return null;
    return joinPage({ today, entry, page: publicBookingPage(html) });
  };
}
