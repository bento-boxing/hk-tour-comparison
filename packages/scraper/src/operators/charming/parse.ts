import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import {
  isIsoDate, parsePriceHkd, TOUR_CODE_PATTERN,
  type IsoDate, type ScrapedDeparture, type ScrapedTour,
} from '@hktours/core';
import { tourPageUrl } from './discover';

// Sources: docs/operators/charming.md, "Where each fact comes from". Everything is in the server-rendered HTML:
// title, code and days (`.tour-title`), day headings (`.tour-journeys-list`), and one row per departure (and
// per variant) in the reservation table: date, status, variant code, adult price. The page's inline
// `var dates = JSON.parse(…)` is not read: it holds one variant per date only, and the table has the rest.

const TITLE = '.tour-title';
/** `11天 …`, `11/12天…` (two variants), `3/4 天 …`: the day counts at the start of the title. */
const TITLE_DAYS = /^(\d+(?:\s*\/\s*\d+)*)\s*天/;
/** ` ~ GHTG`, ` ~ GERD/E`, ` ～ WVJ3/4` at the end of the title: the code, or the variants' codes. */
const TITLE_CODE = /[~～]\s*([A-Za-z0-9_-]+(?:\s*\/\s*[A-Za-z0-9_-]+)*)\s*$/;
const DAY_TITLE = '.tour-journeys-list .tour-journeys-day-title';
const DAY_HEADING = '.tour-journeys-title';
/** `Day 1 (點擊展開行程)`, `Day 10/11` (a night flight), `Day ４` (a full-width digit). Other entries are notes. */
const DAY_LABEL = /^day\s*([0-9０-９]+)(?:\s*\/\s*([0-9０-９]+))?/i;
/** `Day 10/11 (點擊展開行程) - GERD`: a day of one variant only, on a page with two (the other's has `- GERE`). */
const VARIANT_TAG = /\s-\s*([A-Za-z0-9_-]+)\s*$/;
const ROW = '.reservation-table .reservation-table-tr';
const ROW_DATE = '.reservation-table-related_date';
/** `26/12/2026`, `9/01/2027`: day, month, year. */
const TABLE_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
/** The status class of a full date (`額滿`); the site's own script disables it. Others: GT, GP, HP (open). */
const FULL = 'FU';
const ROW_CODE = '.reservation-table-code';
/** A departure's code on a page with variants, `GERE12E-261219`, `WVJ03O-261101`: letters, then the day count. */
const DEPARTURE_CODE = /^([A-Za-z]+)0*(\d+)/;
const ADULT_PRICE = '.reservation-table-td.adt_price';
/** The adult price after the early-booking discount; a date without a discount has only this one. */
const PRICE_NOW = '.detail-discount-price';
const PRICE_BEFORE_DISCOUNT = '.detail-original-price';
const PLACE_SEPARATOR = /[~～]/;
const BRACKETED = /\([^)]*\)|（[^）]*）|【[^】]*】|\[[^\]]*\]/g;
/** `原居地` ("home city"): a tour joined at its first stop, from wherever the traveller lives. Not a place. */
const HOME_CITY = '原居地';
const HONG_KONG = '香港';
/** `杭州/ 上海`, `無錫/南京/上海`, `杭州/上海機場`: either city, as in a flight leg into or out of one of them. */
const EITHER_OR = /^[^/／]+(?:[/／][^/／]+)+$/;
const MAX_POINT_LENGTH = 12;

/** Text with runs of whitespace (including no-break spaces) as one space. */
function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Full-width digits as ASCII (`４` → `4`). */
function asciiDigits(text: string): string {
  return text.replace(/[０-９]/g, digit => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

interface Variant { code: string; days: number }

/**
 * The tour's variants from the title: `11天 … ~ GHTG` is one (GHTG, 11 days); `11/12天 … ~ GERD/E` is two
 * (GERD 11 days, GERE 12 days): each code after a `/` replaces the end of the first. One day count is every
 * variant's. With no day count in the title, the last day label's (`Day 5/6` gives 6), for a single variant.
 * null when there is no code, a code is not a valid one, or the counts do not pair up with the codes.
 */
function variants(title: string, lastLabelledDay: number | null): Variant[] | null {
  const codes = TITLE_CODE.exec(title)?.[1].split('/').map(code => code.trim());
  if (codes === undefined) return null;
  const first = codes[0];
  const expanded = codes.map((code, i) =>
    (i === 0 || code.length >= first.length ? code : first.slice(0, first.length - code.length) + code));
  if (!expanded.every(code => TOUR_CODE_PATTERN.test(code))) return null;

  const counts = TITLE_DAYS.exec(title)?.[1].split('/').map(Number)
    ?? (lastLabelledDay !== null && expanded.length === 1 ? [lastLabelledDay] : []);
  if (counts.length === 0 || (counts.length !== 1 && counts.length !== expanded.length)) return null;
  return expanded.map((code, i) => ({ code, days: counts.length === 1 ? counts[0] : counts[i] }));
}

/** The variant with the most days (the first on a tie): the one the page's day headings run through. */
function longest(list: Variant[]): Variant {
  return list.reduce((best, variant) => (variant.days > best.days ? variant : best));
}

interface Day {
  /** The last day number the label names (`Day 10/11` gives 11). */
  last: number;
  heading: string;
  /** The code the label tags the day with (`- GERD`), or null. */
  variant: string | null;
}

/** Each itinerary day's heading and label; entries without a day label, such as `集合時間及地點`, are notes, left out. */
function days($: CheerioAPI): Day[] {
  const result: Day[] = [];
  for (const title of $(DAY_TITLE).toArray()) {
    const text = asciiDigits(clean($(title).find('h3').first().text()));
    const label = DAY_LABEL.exec(text);
    if (label === null) continue;
    const heading = clean($(title).next('.tour-journeys-detail').find(DAY_HEADING).first().text());
    result.push({ last: Number(label[2] ?? label[1]), heading, variant: VARIANT_TAG.exec(text)?.[1] ?? null });
  }
  return result;
}

/** A heading's places, `~`-separated, each without bracketed notes; `原居地` is not one. */
function places(heading: string): string[] {
  return heading.split(PLACE_SEPARATOR)
    .map(part => clean(part.replace(BRACKETED, ' ')))
    .filter(part => part !== '' && part !== HOME_CITY);
}

/** A place short enough to be a place name, or null. */
function point(place: string | undefined): string | null {
  return place !== undefined && [...place].length <= MAX_POINT_LENGTH ? place : null;
}

/**
 * The headings, with the flight leg next to the home place dropped when it names either of two airports:
 * day 1's after Hong Kong (or the stated start) and the last day's before it (`香港 ~ 杭州/ 上海 ~ 寧波` gives
 * `香港 ~ 寧波`). Any other heading, and any heading without such a leg, is kept as the page gives it.
 */
function withoutFlightLegs(headings: string[], start: string | null, end: string | null): string[] {
  const last = headings.length - 1;
  return headings.map((heading, i) => {
    const parts = heading.split(PLACE_SEPARATOR).map(part => clean(part));
    const place = (part: string) => clean(part.replace(BRACKETED, ' '));
    const isLeg = (at: number) => at >= 0 && at < parts.length && EITHER_OR.test(place(parts[at]));
    const drop = new Set<number>();
    if (i === 0) {
      const home = parts.findIndex(part => place(part) === HONG_KONG || place(part) === start);
      if (home !== -1 && isLeg(home + 1)) drop.add(home + 1);
    }
    if (i === last) {
      const fromEnd = [...parts].reverse().findIndex(part => place(part) === HONG_KONG || place(part) === end);
      const home = fromEnd === -1 ? -1 : parts.length - 1 - fromEnd;
      if (home !== -1 && isLeg(home - 1)) drop.add(home - 1);
    }
    return drop.size === 0 ? heading : parts.filter((_, at) => !drop.has(at)).join(' ~ ');
  });
}

/** `D/MM/YYYY` as an ISO date, or null. */
function tableDate(text: string): IsoDate | null {
  const match = TABLE_DATE.exec(text);
  if (match === null) return null;
  const date = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return isIsoDate(date) ? date : null;
}

/** The row's adult price: after the early-booking discount when there is one. */
function adultPrice(row: Cheerio<Element>): number | null {
  const cell = row.find(ADULT_PRICE).first();
  const now = clean(cell.find(PRICE_NOW).first().text());
  return parsePriceHkd(now !== '' ? now : clean(cell.find(PRICE_BEFORE_DISCOUNT).first().text()));
}

/** True when the departure's code is the variant's: the same letters, then the same day count (`GERE12E` for GERE, 12). */
function isVariantsRow(departureCode: string, variant: Variant): boolean {
  const match = DEPARTURE_CODE.exec(departureCode);
  const letters = /^[A-Za-z]+/.exec(variant.code)?.[0];
  return match !== null && letters !== undefined
    && match[1].toUpperCase() === letters.toUpperCase() && Number(match[2]) === variant.days;
}

/**
 * Every departure the table lists for the variant, not full, with its adult price; past dates are kept
 * (normaliseTour drops them). On a page with variants only the variant's own rows count; null when the
 * table lists dates but none of them is the variant's (its codes are not read as expected).
 */
function departures($: CheerioAPI, variant: Variant, hasVariants: boolean): ScrapedDeparture[] | null {
  const result: ScrapedDeparture[] = [];
  let dated = 0;
  let ours = 0;
  for (const element of $(ROW).toArray()) {
    const row = $(element);
    const date = tableDate(clean(row.find(ROW_DATE).first().text()));
    if (date === null) continue;
    dated++;
    if (hasVariants && !isVariantsRow(clean(row.find(ROW_CODE).first().text()), variant)) continue;
    ours++;
    const full = row.find('.reservation-table-status').toArray().some(status => $(status).hasClass(FULL));
    if (!full) result.push({ date, priceHkd: adultPrice(row) });
  }
  return dated > 0 && ours === 0 ? null : result;
}

/**
 * One Charming Holidays `?tour=<slug>` page as a ScrapedTour; null when it has no title code, or its codes and
 * day counts do not pair up. A page selling two variants (`GERD/E`, 11 or 12 days) gives its longest variant:
 * its code, its day count, its own dates, and the day headings without the days tagged with another variant's code.
 * An old post still lists its old dates (a 2023 post: one date, full): normaliseTour skips it as no-departures.
 * `_today` is accepted for the shared parser signature; every date in the table carries its year.
 */
export function parse(html: string, url: string, _today?: IsoDate): ScrapedTour | null {
  const $ = load(html);
  const title = clean($(TITLE).first().text());
  const itinerary = days($);
  const list = variants(title, itinerary.at(-1)?.last ?? null);
  if (list === null) return null;
  const variant = longest(list);
  const dates = departures($, variant, list.length > 1);
  if (dates === null) return null;

  // A day tagged with another variant's code is that variant's only (GERD's flight home, on a page that sells GERE too).
  const others = new Set(list.filter(v => v !== variant).map(v => v.code.toUpperCase()));
  const headings = itinerary.filter(day => !others.has(day.variant?.toUpperCase() ?? '')).map(day => day.heading);
  const startPoint = point(places(headings[0] ?? '')[0]);
  const endPoint = point(places(headings.at(-1) ?? '').at(-1));

  return {
    operatorId: 'charming',
    code: variant.code,
    url: tourPageUrl(url) ?? url,
    title,
    days: variant.days,
    nights: null,
    dayHeadings: withoutFlightLegs(headings, startPoint, endPoint),
    startPoint,
    endPoint,
    fromPriceHkd: null,
    departures: dates,
  };
}
