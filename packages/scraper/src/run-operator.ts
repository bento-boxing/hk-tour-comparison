import {
  normaliseTour, scrapedTourSchema,
  type IsoDate, type NormalisedTour, type OperatorId, type PlacesIndex, type ScrapedTour,
} from '@hktours/core';
import {
  previousGoodTourCount, recordFailedRun, saveOperatorRun,
  type Db, type RunStats, type UnmatchedName,
} from '@hktours/db';
import { checkRun } from './check-run';
import type { Fetcher, OperatorScraper } from './types';

export interface RunDeps {
  db: Db; fetcher: Fetcher; index: PlacesIndex;
  today: IsoDate; now: () => Date; log: (line: string) => void;
}

export interface RunOutcome { operatorId: OperatorId; ok: boolean; reasons: string[]; toursSaved: number }

/** `1 tour saved`, `2 tours saved`. */
function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** The run's final log line, e.g. `jetour: ok, 1 tour saved, 2 tour pages, 0 parse failures, 0 unmatched names`. */
function summaryLine(
  operatorId: OperatorId, result: string,
  toursSaved: number, pagesFetched: number, parseFailures: number, unmatched: number,
): string {
  return [
    `${operatorId}: ${result}`,
    count(toursSaved, 'tour saved', 'tours saved'),
    count(pagesFetched, 'tour page', 'tour pages'),
    count(parseFailures, 'parse failure', 'parse failures'),
    count(unmatched, 'unmatched name', 'unmatched names'),
  ].join(', ');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The page's tour, or why it is a parse failure. A parser that throws is a failure, not a crash. */
function scrapePage(scraper: OperatorScraper, html: string, url: string): ScrapedTour | { failure: string } {
  let parsed: unknown;
  try {
    parsed = scraper.parse(html, url);
  } catch (error) {
    return { failure: `parser threw: ${errorMessage(error)}` };
  }
  if (parsed === null) return { failure: 'parser returned null' };
  const result = scrapedTourSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    return { failure: `invalid scraped tour (${issues.join('; ')})` };
  }
  if (result.data.operatorId !== scraper.id) {
    return { failure: `operator id ${result.data.operatorId}, expected ${scraper.id}` };
  }
  return result.data;
}

/**
 * One operator's nightly run: discover → fetch → parse → normalise → check → save.
 * A run that fails the checks is recorded but saves nothing, so last night's data stays.
 */
export async function runOperator(scraper: OperatorScraper, deps: RunDeps): Promise<RunOutcome> {
  const { db, fetcher, index, today, now, log } = deps;
  const operatorId = scraper.id;
  const startedAt = now();

  let urls: string[];
  try {
    urls = [...new Set(await scraper.discover(fetcher))];
  } catch (error) {
    log(`${operatorId}: discover failed: ${errorMessage(error)}`);
    const reasons = ['discover-error'];
    const stats: RunStats = { startedAt, finishedAt: now(), pagesFetched: 0, parseFailures: 0 };
    await recordFailedRun(db, { operatorId, runDate: today, stats, reasons });
    log(summaryLine(operatorId, `failed (${reasons.join(', ')})`, 0, 0, 0, 0));
    return { operatorId, ok: false, reasons, toursSaved: 0 };
  }

  const tours = new Map<string, NormalisedTour>(); // by code; the first wins
  const unmatched = new Map<string, string>();     // name → last tour code seen with it
  let pagesFetched = 0;
  let parseFailures = 0;
  const keepUnmatched = (names: string[], tourCode: string) => {
    for (const name of names) unmatched.set(name, tourCode);
  };
  const parseFailure = (url: string, reason: string) => {
    parseFailures++;
    log(`${operatorId}: parse failure ${url}: ${reason}`);
  };

  for (const url of urls) {
    const html = await fetcher.fetchText(url);
    if (html === null) {
      log(`${operatorId}: skipped ${url}: not fetched`);
      continue;
    }
    pagesFetched++;

    const scraped = scrapePage(scraper, html, url);
    if ('failure' in scraped) {
      parseFailure(url, scraped.failure);
      continue;
    }

    const result = normaliseTour(scraped, index, today);
    if (!result.ok) {
      if (result.reason === 'no-departures') {
        log(`${operatorId}: skipped ${url}: no-departures`);
        continue;
      }
      keepUnmatched(result.unmatched, scraped.code);
      const names = result.unmatched.length > 0 ? ` (unmatched: ${result.unmatched.join(', ')})` : '';
      parseFailure(url, `${result.reason}${names}`);
      continue;
    }
    if (tours.has(result.tour.code)) {
      log(`${operatorId}: skipped ${url}: duplicate tour code ${result.tour.code}, keeping the first`);
      continue;
    }
    tours.set(result.tour.code, result.tour);
    keepUnmatched(result.unmatched, result.tour.code);
  }

  const check = checkRun({
    toursNormalised: tours.size,
    tourPagesFetched: pagesFetched,
    parseFailures,
    previousGoodCount: await previousGoodTourCount(db, operatorId),
    minExpectedTours: scraper.minExpectedTours ?? null,
  });
  const stats: RunStats = { startedAt, finishedAt: now(), pagesFetched, parseFailures };
  const unmatchedNames: UnmatchedName[] = [...unmatched].map(([name, tourCode]) => ({ name, tourCode }));

  const reasons: string[] = check.reasons;
  if (check.ok) {
    await saveOperatorRun(db, { operatorId, runDate: today, tours: [...tours.values()], unmatched: unmatchedNames, stats });
  } else {
    await recordFailedRun(db, { operatorId, runDate: today, stats, reasons });
  }
  const toursSaved = check.ok ? tours.size : 0;

  log(summaryLine(operatorId, check.ok ? 'ok' : `failed (${reasons.join(', ')})`,
    toursSaved, pagesFetched, parseFailures, unmatchedNames.length));
  return { operatorId, ok: check.ok, reasons, toursSaved };
}
