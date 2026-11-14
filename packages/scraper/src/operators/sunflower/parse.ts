import { load } from 'cheerio';
import { isIsoDate, parsePriceHkd, type IsoDate, type ScrapedDeparture, type ScrapedTour } from '@hktours/core';
import { bookingUrl, codeOf } from './discover';
import { splitPage } from './fetch-page';
import { CALENDAR, DAYS, MONTH, PRICE } from './public';

// Sources: docs/operators/sunflower.md, "Where each fact comes from". The text is fetchPage's join of the run's date,
// the tour's listing entry and its trimmed booking page. Owner decision 2026-11-14 (a reduced listing): the first
// calendar month's dates with their own prices; the later dates the listing names, with no price of their own (the
// site shows them at the tour's "from" price, marked 起); no day-by-day itinerary.

/** `#5天團`: the days tag. */
const DAYS_TEXT = /(\d+)\s*天/;
/** `2026年12月`: the month the calendar shows. */
const MONTH_TEXT = /^(\d{4})\s*年\s*(\d{1,2})\s*月$/;
/** The class of a full date's cell (`額滿`): never a departure, whatever its link says. */
const FULL_CELL = 'Ava-Calcell-F';
/** A departure cell's link, `window.location='?date=20261201&TourCode=…'`. A full date (`額滿`) has none. */
const CELL_DATE = /[?&]date=(\d{4})(\d{2})(\d{2})(?![0-9])/;
/** A listed later date, `4/12`: day, month, no year. */
const LISTED_DATE = /^(\d{1,2})\/(\d{1,2})$/;
/** Between the names of `subarea`: 、, commas (ASCII and full-width) and the middle dots (`青島‧泰安`, `山西．陝西`). */
const SUBAREA_SEPARATOR = /[、,，‧．·・]/;
/**
 * Guangdong coach variants by code suffix (docs/operators/sunflower.md, "Start / gathering point"): `LW` gathers at
 * the border checkpoint (`關口集散`), `MK` in Mong Kok, `TO` in Tseung Kwan O, `YL` in Yuen Long. The text is
 * written so the shared rules read it as the other operators' Shenzhen border and Hong Kong gathering points are
 * (kinds `sz` and `hk`); the operator's own wording names no checkpoint.
 */
const GATHERING: Record<string, string> = { LW: '深圳關口', MK: '香港旺角', TO: '香港將軍澳', YL: '香港元朗' };
const GUANGDONG_SHORT_TRIPS = '中國短線';

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

/** Text with runs of whitespace as one space, compatibility ideographs as their ordinary characters (峇里島 → 峇里島). */
function clean(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** The title without HTML: tags and entities as the browser reads them (`<br>` a space; `<環島>` is not a tag). */
function titleText(html: string): string {
  const $ = load(html.replace(/<br\s*\/?>/gi, ' '), null, false);
  return clean($.root().text());
}

/**
 * Brackets and marks around a title's parts (`【3天金秋韶關賞銀杏紅葉純玩美食團】`, `《…》`, `▪`): spaces in the route
 * line. The shared rules drop a bracketed note with its text, and a Sunflower title keeps most of its places inside
 * brackets.
 */
const TITLE_MARKS = /[【】《》「」『』〔〕\[\]()（）<>＜＞“”"‘’!！?？:：;；+＋*＊▪•●★☆♥❤&＆]/g;

/** The title as a route line for the shared rules. */
function routeLine(title: string): string {
  return title.replace(TITLE_MARKS, ' ').replace(/\s+/g, ' ').trim();
}

/** A listing price, given as a number (`2699`) or text (`2,699`): whole HKD, or null under 100 or absent. */
function listingPrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? parsePriceHkd(String(Math.trunc(value))) : null;
  return typeof value === 'string' ? parsePriceHkd(value) : null;
}

/**
 * How far ahead a listed `D/M` date may resolve. The furthest real date in the listing of 2026-11-14 was 321 days
 * ahead; a date that passed within the last 30 days (the listing is not always updated at once) resolves 335 to
 * 365 days ahead, a year out, and must be dropped, not listed as next year's departure.
 */
export const MAX_DAYS_AHEAD = 335;

const dayNumber = (date: IsoDate) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000;

/**
 * The listing's `D/M,D/M,…` dates with their year, in the list's order: each the first date on or after `today`
 * with that day and month, dropped when that is more than MAX_DAYS_AHEAD days after today (so a date that has just
 * passed is dropped, not moved a year on). One that is not a real calendar date is dropped, as is any text that is
 * not a `D/M` (the trailing `...`).
 */
export function laterDates(list: unknown, today: IsoDate): IsoDate[] {
  if (typeof list !== 'string') return [];
  const year = Number(today.slice(0, 4));
  const dates: IsoDate[] = [];
  for (const item of list.split(',')) {
    const match = LISTED_DATE.exec(item.replace(/\.+$/, '').trim());
    if (!match) continue;
    const [day, month] = [Number(match[1]), Number(match[2])];
    const date = [year, year + 1, year + 2]
      .map(y => isoOf(y, month, day))
      .find(candidate => isIsoDate(candidate) && candidate >= today);
    if (date !== undefined && dayNumber(date) - dayNumber(today) <= MAX_DAYS_AHEAD) dates.push(date);
  }
  return dates;
}

/**
 * One Sunflower tour (fetchPage's text for its booking page) as a ScrapedTour, or why it is not one. The reasons are
 * fixed texts, never anything from the page, so they can be logged.
 */
export function readTour(text: string, url: string): ScrapedTour | { why: string } {
  const code = codeOf(url);
  if (code === null) return { why: 'not a Sunflower booking page' };
  const joined = splitPage(text);
  if (joined === null) return { why: 'not the joined listing entry and booking page' };
  const { entry, today } = joined;
  if (entry.ItinCode !== code) return { why: 'the listing entry is for another tour' };
  if (!isIsoDate(today)) return { why: 'the run\'s date is not a date' };

  const $ = load(joined.page);
  const days = DAYS_TEXT.exec($(DAYS).first().text());
  if (!days || Number(days[1]) < 1) return { why: 'the booking page has no day count (#Content_lbtnday)' };
  const month = MONTH_TEXT.exec(clean($(CALENDAR).find(MONTH).first().text()));
  if (!month) return { why: 'the booking page has no calendar month' };
  const shownMonth = `${month[1]}-${pad(Number(month[2]))}`;

  // The shown month: every available cell (Ava-Calcell, -G 保證成團, -H 快將成團) with its date link and price; a full
  // cell (Ava-Calcell-F, 額滿) is left out by its class, and has no link either on the pages seen.
  const priceByDate = new Map<IsoDate, number | null>();
  $(CALENDAR).find('td.Calcell').each((_, cell) => {
    const classes = ($(cell).attr('class') ?? '').split(/\s+/);
    if (!classes.some(name => name.startsWith('Ava-Calcell')) || classes.includes(FULL_CELL)) return;
    const link = CELL_DATE.exec($(cell).attr('onclick') ?? '');
    if (!link) return; // no date link: not bookable
    const date = `${link[1]}-${link[2]}-${link[3]}`;
    if (isIsoDate(date) && !priceByDate.has(date)) priceByDate.set(date, parsePriceHkd($(cell).find(PRICE).first().text()));
  });
  // Later months: the dates the listing names outside the shown month, with no price of their own.
  for (const date of [...laterDates(entry.tdp_confirm, today), ...laterDates(entry.tdp_hardpush, today)]) {
    if (date.slice(0, 7) !== shownMonth && !priceByDate.has(date)) priceByDate.set(date, null);
  }
  const departures: ScrapedDeparture[] = [...priceByDate]
    .map(([date, priceHkd]) => ({ date, priceHkd }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const guangdong = entry.region === GUANGDONG_SHORT_TRIPS;
  const gathering = guangdong ? GATHERING[code.slice(-2)] ?? null : null;
  const title = titleText(entry.Title);
  const subarea = clean(entry.subarea).split(SUBAREA_SEPARATOR).map(name => name.trim()).filter(name => name !== '');
  const area = clean(entry.area);
  // No day headings (the itinerary is a PDF robots.txt disallows). The region is a sales grouping, never read. Which
  // text gives a stop is left to normaliseTour, which reads the fallback texts in order under the title rules, so a
  // text the rules empty falls through to the next one (the parser never matches places itself):
  // - Every tour: the subarea's names stand in for the headings (their unmatched names are reported); then the area;
  //   then, as a last resort (owner decision 2026-11-15), the title.
  // - Guangdong short trips (owner decision 2026-11-14): their subarea is the same `廣州、中山、深圳` whatever the tour
  //   visits, so the title comes first, then the subarea, then the area, all as fallback texts.
  const titleLine = routeLine(title);
  const route = guangdong
    ? { line: [], fallback: [titleLine, subarea.join('、'), area] }
    : { line: subarea, fallback: [area, titleLine] };
  const fallbackRoute = route.fallback.filter(text => text !== '');
  return {
    operatorId: 'sunflower',
    code,
    url: bookingUrl(code),
    title,
    days: Number(days[1]),
    nights: null,
    dayHeadings: route.line,
    ...(fallbackRoute.length === 0 ? {} : { fallbackRoute }),
    // A province listed beside its own cities (`廣西、桂林`, `雲南、昆明、…`) is a tag, not a stop.
    dropRegionWithListedCity: true,
    startPoint: gathering,
    endPoint: gathering,
    fromPriceHkd: listingPrice(entry.discount) ?? listingPrice(entry.discounttext) ?? listingPrice(entry.minprice),
    departures,
  };
}

/** One Sunflower tour as a ScrapedTour; null when it is not one (see readTour for the reasons). */
export function parse(text: string, url: string): ScrapedTour | null {
  const tour = readTour(text, url);
  return 'why' in tour ? null : tour;
}
