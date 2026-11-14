import {
  normaliseTour, scrapedTourSchema, type IsoDate, type PlacesIndex, type ScrapedTour, type Stop,
} from '@hktours/core';
import type { OperatorScraper } from './types';

/** What the parser returned for one fetched page (null when it rejected the page). */
interface ParsedPage { url: string; parsed: unknown }

/** One fetched page as `--dry-run` prints it, so matches can be checked by eye. */
export type PageDescription =
  | { url: string; result: 'parser-null' | 'invalid' }
  | {
    url: string; code: string;
    result: 'ok' | 'no-stops' | 'no-departures' | 'no-price';
    /** Stops of a saved tour as `name (country)`; empty when the tour was not saved. */
    route: string[];
    unmatched: string[];
    dayHeadings: string[]; startPoint: string | null; endPoint: string | null;
  };

export interface DryRunRecorder {
  /** The scraper to run: discovers at most `limit` URLs and remembers every parse. */
  scraper: OperatorScraper;
  /** How many URLs discover found before the limit, or null before it has run. */
  discovered(): number | null;
  pages: ParsedPage[];
}

/** Wraps a scraper so a dry run can report on every page it parsed. */
export function recordDryRun(scraper: OperatorScraper, limit: number | null): DryRunRecorder {
  let discovered: number | null = null;
  const pages: ParsedPage[] = [];
  return {
    pages,
    discovered: () => discovered,
    scraper: {
      id: scraper.id,
      minExpectedTours: scraper.minExpectedTours,
      fetchPage: scraper.fetchPage,
      requestHeaders: scraper.requestHeaders,
      async discover(fetcher) {
        const urls = [...new Set(await scraper.discover(fetcher))];
        discovered = urls.length;
        return limit === null ? urls : urls.slice(0, limit);
      },
      parse(html, url) {
        let parsed: ScrapedTour | null;
        try {
          parsed = scraper.parse(html, url);
        } catch (error) {
          pages.push({ url, parsed: null }); // a parser that throws its reason rejected the page all the same
          throw error;
        }
        pages.push({ url, parsed });
        return parsed;
      },
    },
  };
}

function stopName(stop: Stop, index: PlacesIndex): string {
  const place = stop.cityId !== null ? index.city(stop.cityId) : index.region(stop.regionId);
  return `${place?.nameZh ?? stop.cityId ?? stop.regionId} (${index.country(stop.countryId)?.nameZh ?? stop.countryId})`;
}

/**
 * The page's outcome, normalised the way runOperator normalises it. This mirrors the
 * scrapedTourSchema.safeParse and normaliseTour sequence in run-operator.ts and must change with it.
 */
export function describePage(page: ParsedPage, index: PlacesIndex, today: IsoDate): PageDescription {
  const { url, parsed } = page;
  if (parsed === null) return { url, result: 'parser-null' };
  const checked = scrapedTourSchema.safeParse(parsed);
  if (!checked.success) return { url, result: 'invalid' };
  const scraped = checked.data;
  const normalised = normaliseTour(scraped, index, today);
  return {
    url,
    code: scraped.code,
    result: normalised.ok ? 'ok' : normalised.reason,
    route: normalised.ok ? normalised.tour.stops.map(stop => stopName(stop, index)) : [],
    unmatched: normalised.unmatched,
    dayHeadings: scraped.dayHeadings,
    startPoint: scraped.startPoint,
    endPoint: scraped.endPoint,
  };
}

/** Each unmatched name with the number of pages it appeared on, most frequent first. */
export function unmatchedCounts(pages: PageDescription[]): [name: string, count: number][] {
  const counts = new Map<string, number>();
  for (const page of pages) {
    if (!('unmatched' in page)) continue;
    for (const name of page.unmatched) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].sort(([a, m], [b, n]) => n - m || (a < b ? -1 : a > b ? 1 : 0));
}

/** `  2 亞特蘭提斯` lines, counts right-aligned. */
export function formatUnmatched(counts: [name: string, count: number][]): string[] {
  const width = Math.max(1, ...counts.map(([, count]) => String(count).length));
  return counts.map(([name, count]) => `  ${String(count).padStart(width)} ${name}`);
}
