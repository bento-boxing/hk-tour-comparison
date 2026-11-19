import { isIsoDate, type IsoDate } from '@hktours/core';
import { PUBLIC_LOG, type LogView } from '../../public-log';
import type { Fetcher } from '../../types';
import { eventUrl, SAME_SITE, tourIdOf, tourPageUrl } from './discover';
import { codeOf, isBookable, publicDates, publicTourPage, type PublicDate } from './public';

/** What `parse` reads for one tour: the run's date (Hong Kong), its trimmed tour page and its dates answer's dates. */
export interface TourPage { today: IsoDate; page: string; dates: PublicDate[] }

export function joinPage(tour: TourPage): string {
  return JSON.stringify(tour);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The parts of a joinPage text (or a fixture written as one); null for any other text. */
export function splitPage(text: string): TourPage | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(value) || typeof value.today !== 'string' || typeof value.page !== 'string' || !Array.isArray(value.dates)) return null;
  return value as unknown as TourPage;
}

/**
 * Taste Travel's fetchPage: the tour page, then its dates answer, one plain GET each through the run's fetcher (which
 * spaces, checks and logs every request; a redirect off https://tastetravel.com.hk is refused: not fetched), joined
 * with the run's date. Only the public facts (public.ts) are kept. null, not fetched, when either gets no answer (the
 * dates are not asked for without a tour page) or the dates answer is not a JSON list. Each date with a status other
 * than the three known is logged, by its value only (through the run's log view: the public log shows a value that is
 * not plain text by its reference), and the parser skips it. It throws, requesting nothing, for a URL that is not a
 * tour page. The site's session cookie is never kept or sent back: the fetcher keeps no cookies.
 */
export function createFetchPage(
  log: (line: string) => void, logView: () => LogView = () => PUBLIC_LOG,
): (fetcher: Fetcher, url: string, today: IsoDate) => Promise<string | null> {
  return async (fetcher, url, today) => {
    const id = tourIdOf(url);
    if (id === null) throw new Error('not a Taste Travel tour page');
    const html = await fetcher.fetchText(tourPageUrl(id), SAME_SITE);
    if (html === null) return null;
    const page = publicTourPage(html);
    const name = codeOf(page) ?? `tour_id ${id}`;
    const answer = await fetcher.fetchText(eventUrl(id), SAME_SITE);
    if (answer === null) return null;
    const dates = publicDates(answer);
    if (dates === null) {
      log(`taste: ${name}: the dates answer is not a JSON list`);
      return null;
    }
    const view = logView();
    let malformed = 0;
    for (const { date, title } of dates) {
      if (isBookable(title)) {
        if (!isIsoDate(date)) malformed++;
        continue;
      }
      const shownDate = isIsoDate(date) ? date : '(not a date)';
      log(`taste: ${name}: date ${shownDate} has the status ${title === '' ? '(none)' : view.message(title)}, skipped`);
    }
    // A change in the dates' format shows in the log (a count only: the text is the site's), not as a quiet drop.
    if (malformed > 0) log(`taste: ${name}: ${malformed} bookable ${malformed === 1 ? 'date' : 'dates'} not in YYYY-MM-DD form, skipped`);
    return joinPage({ today, page, dates });
  };
}
