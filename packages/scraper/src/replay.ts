import { isIsoDate, type IsoDate, type NormaliseResult, type OperatorId, type PlacesIndex, type ScrapedTour, type Stop } from '@hktours/core';

/**
 * Replaying saved crawl logs (scripts/replay-logs.ts): each `page {…}` line a dry run printed (dry-run-report.ts) is
 * normalised again with the core under test, so a change to places or rules can be checked against real operator
 * text before it ships. Offline: only the logged parser output is read, never a page; parser changes made since the
 * crawl are therefore not replayed.
 */

/** A dry run's `page` line, as far as replaying needs it. */
export interface LoggedPage {
  url: string; code?: string; result: string;
  dayHeadings?: string[]; startPoint?: string | null; endPoint?: string | null;
  fallbackRoute?: string | string[]; days?: number;
}

/** The parts of a core build replaying uses (the working tree's, or an older commit's). */
export interface ReplayCore {
  normaliseTour(scraped: ScrapedTour, index: PlacesIndex, today: IsoDate): NormaliseResult;
  places: PlacesIndex;
}

/** Where a replayed page's days came from (daysOf); `headings` means the log gave no usable count. */
export type DaysSource = 'log' | 'text' | 'code' | 'headings';

/**
 * One replayed page: its result with the logged departures, its route as it would be with dates on sale, and the
 * days the route rules were given (null for a page the parser rejected).
 */
export interface ReplayedPage {
  url: string; code: string | null; result: string; route: string[];
  days?: number | null; daysFrom?: DaysSource | null;
}

/**
 * Operators whose parser sets ScrapedTour.dropRegionWithListedCity; the log line does not record it. Keep in step
 * with the parsers (operators/yummy, operators/sunflower).
 */
const DROP_REGION_WITH_LISTED_CITY: readonly string[] = ['yummy', 'sunflower'];
const TODAY = '2026-01-01';
const FUTURE = '2026-02-01';

/**
 * The newest of an operator directory's dry-run logs, by file name: `dry-run-<n>.log` (the highest n), or
 * `dry-run-<YYYY-MM-DD>.log` (the latest date; Taste's practice crawl, task 48), which counts as newer than any
 * numbered log. Undefined when there is none.
 */
export function newestLogName(names: string[]): string | undefined {
  const rank = (name: string): [dated: number, order: string] | undefined => {
    const numbered = /^dry-run-(\d+)\.log$/.exec(name);
    if (numbered) return [0, numbered[1].padStart(12, '0')];
    const dated = /^dry-run-(\d{4}-\d{2}-\d{2})\.log$/.exec(name);
    return dated && isIsoDate(dated[1]) ? [1, dated[1]] : undefined;
  };
  let newest: { name: string; rank: [number, string] } | undefined;
  for (const name of names) {
    const r = rank(name);
    if (r === undefined) continue;
    if (newest === undefined || r[0] > newest.rank[0] || (r[0] === newest.rank[0] && r[1] > newest.rank[1])) newest = { name, rank: r };
  }
  return newest?.name;
}

/** The `page {…}` lines of a dry-run log. */
export function logPages(text: string): LoggedPage[] {
  return text.split('\n').filter(line => line.startsWith('page {')).map(line => JSON.parse(line.slice(5)) as LoggedPage);
}

/**
 * Where an operator's tour code carries the days (logs older than the `days` field): Sunflower `LRHC08SS`, EGL
 * `HTJEKT06`, Yummy `KL-H-TH05`. Checked against the saved logs and fixtures (task 33).
 */
const DAYS_IN_CODE: Readonly<Record<string, RegExp>> = {
  sunflower: /^[A-Z]{4}(\d{2})/, egl: /(\d{2})[A-Z]{0,2}$/, yummy: /(\d{2})[A-Z]{0,2}$/,
};

/**
 * `N天` in a title, but not an early-booking offer's `N天前` (N days before departure) or `提前N天`: Big Line's long-haul
 * titles end with `60天前` offers, which would otherwise read as 60 days.
 */
const STATED_DAYS = /(?<!提前\s*|\d)(\d+)\s*天(?!\s*前)/g;

/**
 * The logged days, else the last `N天` of the fallback text, else the code's days, else one per day heading. A page
 * with none of the first three still gets the too-far rule, on its heading count, and is counted (daysFromHeadings)
 * and marked in the changed-route list, so that it neither escapes the rule nor suffers it unseen: the run itself
 * always has the parser's days (ScrapedTour.days is required), and a sweep should show what the rule would do.
 */
function daysOf(operatorId: string, page: LoggedPage): { days: number; daysFrom: DaysSource } {
  const valid = (n: number | undefined): n is number => n !== undefined && Number.isInteger(n) && n >= 1 && n <= 60;
  if (valid(page.days)) return { days: page.days, daysFrom: 'log' };
  const texts = typeof page.fallbackRoute === 'string' ? [page.fallbackRoute] : page.fallbackRoute ?? [];
  const stated = texts.flatMap(text => [...text.matchAll(STATED_DAYS)].map(match => Number(match[1]))).at(-1);
  if (valid(stated)) return { days: stated, daysFrom: 'text' };
  const coded = DAYS_IN_CODE[operatorId]?.exec(page.code ?? '');
  if (coded && valid(Number(coded[1]))) return { days: Number(coded[1]), daysFrom: 'code' };
  return { days: Math.max(1, Math.min(60, page.dayHeadings?.length ?? 1)), daysFrom: 'headings' };
}

const stopKey = (stop: Stop) => stop.cityId ?? `region:${stop.regionId}`;

/**
 * The page normalised again: the result with the departures the log implies (none for a logged `no-departures`, an
 * unpriced one for `no-price`, else one future priced date), and the route with one future priced date whatever the
 * log says, so a tour with no dates on sale today is compared too.
 */
export function replayPage(operatorId: string, page: LoggedPage, core: ReplayCore): ReplayedPage {
  if (page.code === undefined || page.dayHeadings === undefined) {
    return { url: page.url, code: null, result: page.result, route: [], days: null, daysFrom: null };
  }
  const { days, daysFrom } = daysOf(operatorId, page);
  const scraped: ScrapedTour = {
    operatorId: operatorId as OperatorId, code: page.code, url: page.url, title: '', days, nights: null,
    dayHeadings: page.dayHeadings, startPoint: page.startPoint ?? null, endPoint: page.endPoint ?? null,
    fromPriceHkd: 1000, departures: [{ date: FUTURE, priceHkd: 1000 }],
    ...(page.fallbackRoute !== undefined ? { fallbackRoute: page.fallbackRoute } : {}),
    ...(DROP_REGION_WITH_LISTED_CITY.includes(operatorId) ? { dropRegionWithListedCity: true } : {}),
  };
  const withDates = core.normaliseTour(scraped, core.places, TODAY);
  const asLogged = page.result === 'no-departures' ? { ...scraped, departures: [] }
    : page.result === 'no-price' ? { ...scraped, fromPriceHkd: null, departures: [{ date: FUTURE, priceHkd: null }] }
    : scraped;
  const result = core.normaliseTour(asLogged, core.places, TODAY);
  return {
    url: page.url, code: page.code,
    result: result.ok ? 'ok' : result.reason,
    route: withDates.ok ? withDates.tour.stops.map(stopKey) : [],
    days, daysFrom,
  };
}

export interface ReplayCounts {
  pages: number; saved: number; noStops: number; noDepartures: number; noPrice: number; notParsed: number;
  /** Parse failures as a run counts them (not parsed, no-stops, no-price), and their share of the pages. */
  failures: number; failureRate: number;
  /** Parsed pages whose days came only from the number of day headings (no logged, stated or coded count). */
  daysFromHeadings: number;
}

export function countsOf(pages: ReplayedPage[]): ReplayCounts {
  const count = (result: string) => pages.filter(page => page.result === result).length;
  const saved = new Set(pages.filter(page => page.result === 'ok').map(page => page.code)).size;
  const notParsed = pages.filter(page => page.code === null).length;
  const failures = notParsed + count('no-stops') + count('no-price');
  return {
    pages: pages.length, saved, noStops: count('no-stops'), noDepartures: count('no-departures'), noPrice: count('no-price'),
    notParsed, failures, failureRate: pages.length === 0 ? 0 : failures / pages.length,
    daysFromHeadings: pages.filter(page => page.daysFrom === 'headings').length,
  };
}

export interface ChangedRoute {
  url: string; code: string | null; before: string[]; after: string[];
  days?: number | null; daysFrom?: DaysSource | null;
}

/** Every page, by URL, whose route (with dates on sale) differs between two replays of the same log. */
export function changedRoutes(before: ReplayedPage[], after: ReplayedPage[]): ChangedRoute[] {
  const earlier = new Map(before.map(page => [page.url, page]));
  return after.flatMap(page => {
    const old = earlier.get(page.url);
    if (old === undefined || old.route.join('>') === page.route.join('>')) return [];
    return [{ url: page.url, code: page.code, before: old.route, after: page.route, days: page.days, daysFrom: page.daysFrom }];
  });
}
