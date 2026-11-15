import {
  normaliseTour, scrapedTourSchema, TOUR_CODE_PATTERN,
  type IsoDate, type NormalisedTour, type OperatorId, type PlacesIndex, type ScrapedTour, type Stop,
} from '@hktours/core';
import {
  previousGoodTourCount, recordFailedRun, saveOperatorRun,
  type Db, type RunStats, type UnmatchedName,
} from '@hktours/db';
import { checkRun } from './check-run';
import { PUBLIC_LOG, type LogView } from './public-log';
import type { Fetcher, OperatorScraper, PageSkip } from './types';

export interface RunDeps {
  db: Db; fetcher: Fetcher; index: PlacesIndex;
  today: IsoDate; now: () => Date; log: (line: string) => void;
  /**
   * How a log line shows a page's address before its tour code is known, and an error's message (see public-log.ts).
   * Unset: PUBLIC_LOG, for a real run, whose log is public. A dry run passes DRY_RUN_LOG.
   */
  logView?: LogView;
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

/** `中山 → 珠海`: the stops by name. */
function routeText(stops: Stop[], index: PlacesIndex): string {
  return stops
    .map(stop => (stop.cityId !== null ? index.city(stop.cityId)?.nameZh ?? stop.cityId : index.region(stop.regionId)?.nameZh ?? stop.regionId))
    .join(' → ');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The parsed value's tour code when it is a valid one (TOUR_CODE_PATTERN: ASCII letters, digits, `_` and `-`), so a
 * page that fails the schema for another reason is still named by its code; null otherwise.
 */
function validCode(parsed: unknown): string | null {
  const code = typeof parsed === 'object' && parsed !== null ? (parsed as { code?: unknown }).code : undefined;
  return typeof code === 'string' && TOUR_CODE_PATTERN.test(code) ? code : null;
}

/**
 * The page's tour, or why it is a parse failure, with its tour code when one is known (null when the parser gave no
 * valid one). A parser that throws is a failure, not a crash; its message is shown through `view`, since it may
 * quote what the parser read.
 */
function scrapePage(scraper: OperatorScraper, html: string, url: string, view: LogView):
  ScrapedTour | { failure: string; code: string | null } {
  let parsed: unknown;
  try {
    parsed = scraper.parse(html, url);
  } catch (error) {
    return { failure: `parser threw: ${view.message(errorMessage(error))}`, code: null };
  }
  if (parsed === null) return { failure: 'parser returned null', code: null };
  const result = scrapedTourSchema.safeParse(parsed);
  if (!result.success) {
    // The schema's own wording and the fields' names, never the values read.
    const issues = result.error.issues.map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    return { failure: `invalid scraped tour (${issues.join('; ')})`, code: validCode(parsed) };
  }
  if (result.data.operatorId !== scraper.id) {
    return { failure: `operator id ${result.data.operatorId}, expected ${scraper.id}`, code: result.data.code };
  }
  return result.data;
}

/**
 * One operator's nightly run: discover → fetch → parse → normalise → check → save.
 * A run that fails the checks is recorded but saves nothing, so last night's data stays.
 */
export async function runOperator(scraper: OperatorScraper, deps: RunDeps): Promise<RunOutcome> {
  const { db, fetcher, index, today, now, log, logView: view = PUBLIC_LOG } = deps;
  const operatorId = scraper.id;
  const startedAt = now();

  let urls: string[];
  try {
    urls = [...new Set(await scraper.discover(fetcher, view))];
  } catch (error) {
    log(`${operatorId}: discover failed: ${view.message(errorMessage(error))}`);
    const reasons = ['discover-error'];
    const stats: RunStats = { startedAt, finishedAt: now(), pagesFetched: 0, parseFailures: 0 };
    await recordFailedRun(db, { operatorId, runDate: today, stats, reasons });
    log(summaryLine(operatorId, `failed (${reasons.join(', ')})`, 0, 0, 0, 0));
    return { operatorId, ok: false, reasons, toursSaved: 0 };
  }

  const tours = new Map<string, NormalisedTour>(); // by code; the first wins
  const fromFallback = new Set<string>();           // codes of the saved tours whose route came from fallbackRoute
  const unmatched = new Map<string, string>();     // name → last tour code seen with it
  let pagesFetched = 0;
  let pagesNotFetched = 0; // not parse failures, but counted toward checkRun's fetch-failure rate
  let pagesGone = 0;       // the operator says the tour no longer exists: left out of that rate altogether
  let parseFailures = 0;
  const keepUnmatched = (names: string[], tourCode: string) => {
    for (const name of names) unmatched.set(name, tourCode);
  };
  // The log is public: a line about one page names it by its tour code once that is known, and before that by its
  // address as the log view shows it (a title carried in the address hidden, see public-log.ts).
  const parseFailure = (page: string, reason: string) => {
    parseFailures++;
    log(`${operatorId}: parse failure ${page}: ${reason}`);
  };

  for (const url of urls) {
    let page: string | PageSkip | null;
    let why = '';
    try {
      page = scraper.fetchPage ? await scraper.fetchPage(fetcher, url, today) : await fetcher.fetchText(url);
    } catch (error) {
      page = null;
      // fetchPage, or a fetchText breaking its never-throws contract
      why = ` (fetch threw: ${view.message(errorMessage(error))})`;
    }
    if (page !== null && typeof page === 'object') {
      // the tour is gone: neither fetched nor a fetch failure
      log(`${operatorId}: skipped ${view.address(url)}: ${page.skip}`);
      pagesGone++;
      continue;
    }
    const html = page;
    if (html === null) {
      log(`${operatorId}: skipped ${view.address(url)}: not fetched${why}`);
      pagesNotFetched++;
      continue;
    }
    pagesFetched++;

    const scraped = scrapePage(scraper, html, url, view);
    if ('failure' in scraped) {
      parseFailure(scraped.code ?? view.address(url), scraped.failure);
      continue;
    }

    const result = normaliseTour(scraped, index, today);
    // The places the day-line rules dropped (task 35), so a drop is visible in the run's log as in a dry run: the
    // tour code and place names from the places data only, never the day-line text.
    if (result.dayHeadingsDropped !== undefined) {
      log(`${operatorId}: day-line drops ${scraped.code}: ${result.dayHeadingsDropped.map(d => `${d.name} (${d.rule})`).join(', ')}`);
    }
    if (!result.ok) {
      if (result.reason === 'no-departures') {
        log(`${operatorId}: skipped ${scraped.code}: no-departures`);
        continue;
      }
      keepUnmatched(result.unmatched, scraped.code); // stored for review as before, headings included
      // The log is public: day-heading text (unmatchedAreHeadings) and unmatched words are the operator's phrases, so
      // only their count is printed. The words themselves are stored (keepUnmatched) and shown by a dry run.
      const names = result.unmatched.length === 0 ? ''
        : result.unmatchedAreHeadings === true
          ? ` (${count(result.unmatched.length, 'day heading', 'day headings')}, no place named)`
          : ` (${count(result.unmatched.length, 'unmatched word', 'unmatched words')})`;
      parseFailure(scraped.code, `${result.reason}${names}`);
      continue;
    }
    if (tours.has(result.tour.code)) {
      log(`${operatorId}: skipped ${result.tour.code}: duplicate tour code, keeping the first`);
      continue;
    }
    tours.set(result.tour.code, result.tour);
    if (result.routeFromFallback) fromFallback.add(result.tour.code);
    keepUnmatched(result.unmatched, result.tour.code);
  }

  const check = checkRun({
    toursNormalised: tours.size,
    tourPagesFetched: pagesFetched,
    parseFailures,
    previousGoodCount: await previousGoodTourCount(db, operatorId),
    minExpectedTours: scraper.minExpectedTours ?? null,
    pagesDiscovered: urls.length - pagesGone, // a gone page would otherwise dilute the fetch-failure rate
    pagesNotFetched,
  });
  const stats: RunStats = { startedAt, finishedAt: now(), pagesFetched, parseFailures };
  const unmatchedNames: UnmatchedName[] = [...unmatched].map(([name, tourCode]) => ({ name, tourCode }));

  const reasons: string[] = check.reasons;
  if (check.ok) {
    const changed = await saveOperatorRun(db, { operatorId, runDate: today, tours: [...tours.values()], unmatched: unmatchedNames, stats });
    // Routes read from a title are checked by eye (owner request 2026-11-14): only the new and changed ones are listed.
    for (const { code, previous } of changed) {
      if (!fromFallback.has(code)) continue;
      const route = routeText(tours.get(code)!.stops, index);
      log(previous.length === 0
        ? `${operatorId}: new title route ${code}: ${route}`
        : `${operatorId}: changed title route ${code}: ${route} (was ${routeText(previous, index)})`);
    }
  } else {
    await recordFailedRun(db, { operatorId, runDate: today, stats, reasons });
  }
  const toursSaved = check.ok ? tours.size : 0;

  log(summaryLine(operatorId, check.ok ? 'ok' : `failed (${reasons.join(', ')})`,
    toursSaved, pagesFetched, parseFailures, unmatchedNames.length));
  return { operatorId, ok: check.ok, reasons, toursSaved };
}
