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
/** Codes: `GHTG`, `GERD/E`, `WVJ3/4`, `GAKA/GAKVA`. */
const CODES = '[A-Za-z0-9_-]+(?:\\s*\\/\\s*[A-Za-z0-9_-]+)*';
/**
 * ` ~ GHTG`, ` ~ GERD/E`, ` ～ WVJ3/4` at the end of the title: the code, or the variants' codes. A bracketed note
 * may follow (` ~ GHTH 《農曆新年2027》`, ` ~ PCJSC【…】`, ` ~ GEFM (增遊…)`), with no `~` in it, so the code is the last one.
 */
const TITLE_CODE = new RegExp(`[~～]\\s*(${CODES})\\s*(?:[【《(（\\[「〔][^~～]*)?$`);
const DAY_TITLE = '.tour-journeys-list .tour-journeys-day-title';
const DAY_HEADING = '.tour-journeys-title';
/**
 * `Day 1 (點擊展開行程)`, `Day 10/11` (a night flight), `Day ４` (a full-width digit, made ASCII first), and with a
 * variant's code before it (`GAKVA Day 1`). Other entries (`集合時間及地點`, `旅遊須知`, `自費節目一覽表`) are notes.
 */
const DAY_LABEL = new RegExp(`^(?:(${CODES})\\s+)?day\\s*(\\d+)(?:\\s*\\/\\s*(\\d+))?`, 'i');
/** `Day 10/11 (點擊展開行程) - GERD`, `- GERD/E`: a day of the variant(s) named only (the other's has `- GERE`). */
const VARIANT_TAG = new RegExp(`\\s-\\s*(${CODES})\\s*$`);
/** An entry with this label states where a tour joined abroad gathers (Canadian local tours). */
const GATHERING = '集合時間及地點';
const ROW = '.reservation-table .reservation-table-tr';
const ROW_DATE = '.reservation-table-related_date';
/** `26/12/2026`, `9/01/2027`: day, month, year. */
const TABLE_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
/** The status class of a full date (`額滿`); the site's own script disables it. Others: GT, GP, HP (open). */
const FULL = 'FU';
const ROW_CODE = '.reservation-table-code';
/** A departure's code, `GERE12E-261219`, `WVJ03O-261101`: letters, then the day count (here with a leading zero). */
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
/** A start or end naming either is home (kind hk or sz), whatever else the page says. */
const HOME_PLACES = ['香港', '深圳'];
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

/** `GERD/E` as GERD and GERE: each code after a `/` replaces the end of the first; a code as long is taken as it is. */
function expandCodes(text: string): string[] {
  const codes = text.split('/').map(code => code.trim());
  const first = codes[0];
  return codes.map((code, i) =>
    (i === 0 || code.length >= first.length ? code : first.slice(0, first.length - code.length) + code));
}

/**
 * The tour's variants from the title: `11天 … ~ GHTG` is one (GHTG, 11 days); `11/12天 … ~ GERD/E` is two
 * (GERD 11 days, GERE 12 days): each code after a `/` replaces the end of the first. One day count is every
 * variant's. With no day count in the title, the last day label's (`Day 5/6` gives 6), for a single variant.
 * null when there is no code, a code is not a valid one, or the counts do not pair up with the codes.
 */
function variants(title: string, lastLabelledDay: number | null): Variant[] | null {
  const codes = TITLE_CODE.exec(title)?.[1];
  if (codes === undefined) return null;
  const expanded = expandCodes(codes);
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

/** Same code, ignoring case. */
const sameCode = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();

interface Day {
  /** The last day number the label names (`Day 10/11` gives 11). */
  last: number;
  heading: string;
  /** The codes the label tags the day with (`GAKVA Day 1`, `- GERD`, `- GERD/E`); none for a day of every variant. */
  tags: string[];
}

/** Each itinerary day's heading and label; entries without a day label, such as `集合時間及地點`, are notes, left out. */
function days($: CheerioAPI): Day[] {
  const result: Day[] = [];
  for (const title of $(DAY_TITLE).toArray()) {
    const text = asciiDigits(clean($(title).find('h3').first().text()));
    const label = DAY_LABEL.exec(text);
    if (label === null) continue;
    const heading = clean($(title).next('.tour-journeys-detail').find(DAY_HEADING).first().text());
    const tagged = [label[1], VARIANT_TAG.exec(text)?.[1]].filter((tag): tag is string => tag !== undefined);
    result.push({ last: Number(label[3] ?? label[2]), heading, tags: tagged.flatMap(expandCodes) });
  }
  return result;
}

/** A heading's places, `~`-separated, without bracketed notes (removed first: `羅馬(鬥獸場 ~ 許願池)`); `原居地` is not one. */
function places(heading: string): string[] {
  return heading.replace(BRACKETED, ' ').split(PLACE_SEPARATOR)
    .map(part => clean(part))
    .filter(part => part !== '' && part !== HOME_CITY);
}

/**
 * A stated start or end: Hong Kong or Shenzhen always; a place abroad only when the page says the tour is
 * joined there (`原居地` in that day's heading, or an entry giving the gathering time and place). Otherwise a
 * Hong Kong tour whose first or last heading names only sights abroad (`青島（中山公園…）`) would get a start or
 * end abroad. null when there is none, or it is too long to be a place name.
 */
function point(place: string | undefined, heading: string, joinedAbroad: boolean): string | null {
  if (place === undefined || [...place].length > MAX_POINT_LENGTH) return null;
  const home = HOME_PLACES.some(name => place.includes(name));
  return home || joinedAbroad || heading.includes(HOME_CITY) ? place : null;
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

/** True when the departure's code is the variant's by letters and day count (`WVJ04O` for WVJ4: WVJ, 4 days). */
function sameLettersAndDays(departureCode: string, variant: Variant): boolean {
  const match = DEPARTURE_CODE.exec(departureCode);
  const letters = /^[A-Za-z]+/.exec(variant.code)?.[0];
  return match !== null && letters !== undefined && sameCode(match[1], letters) && Number(match[2]) === variant.days;
}

interface Row {
  date: IsoDate; code: string;
  /** The adult price, full or not (for choosing between variants). */
  price: number | null;
  /** null when full. */
  departure: ScrapedDeparture | null;
}

/** Every dated row of the table: its code (or ''), and its departure, null when full. */
function tableRows($: CheerioAPI): Row[] {
  const rows: Row[] = [];
  for (const element of $(ROW).toArray()) {
    const row = $(element);
    const date = tableDate(clean(row.find(ROW_DATE).first().text()));
    if (date === null) continue;
    const full = row.find('.reservation-table-status').toArray().some(status => $(status).hasClass(FULL));
    const price = adultPrice(row);
    rows.push({ date, code: clean(row.find(ROW_CODE).first().text()), price, departure: full ? null : { date, priceHkd: price } });
  }
  return rows;
}

/** True when the row's code is the variant's code followed by a digit (`GERE12E-…` for GERE, not `GVRBX10A-…` for GVRB). */
function startsWithCode(departureCode: string, variant: Variant): boolean {
  const code = departureCode.toUpperCase();
  const own = variant.code.toUpperCase();
  return code.startsWith(own) && /\d/.test(code.charAt(own.length));
}

/**
 * Each row given to exactly one variant: the one whose code, followed by a digit, starts the row's (`GERE12E-…` is
 * GERE's; with GVRB/GVRBX, `GVRBX10A-…` is GVRBX's and `GVRB08A-…` GVRB's; the longest such code wins), else the
 * first with the row's letters and day count (`WVJ04O-…` is WVJ4's). Variants that share both (`ABC1/2`, same
 * days, rows `ABC05…`) cannot be told apart: every such row goes to the first, deterministically. A row that is
 * no variant's is left out. Without a code column, every row is every variant's, but only when all variants have
 * the same day count (`GRCSB/A/S`: cabin grades sold on the same dates); with different day counts (GAKA/GAKVA,
 * 11 and 14 days) the rows cannot be told apart: 'ambiguous'.
 */
function rowsByVariant(list: Variant[], rows: Row[]): Map<Variant, Row[]> | 'ambiguous' {
  const byVariant = new Map<Variant, Row[]>(list.map(variant => [variant, []]));
  const coded = list.length > 1 && rows.some(row => row.code !== '');
  if (!coded && rows.length > 0 && new Set(list.map(variant => variant.days)).size > 1) return 'ambiguous';
  for (const row of rows) {
    if (!coded) {
      for (const variant of list) byVariant.get(variant)!.push(row);
      continue;
    }
    const byCode = list.filter(variant => startsWithCode(row.code, variant))
      .reduce<Variant | undefined>((best, variant) => (best === undefined || variant.code.length > best.code.length ? variant : best), undefined);
    const owner = byCode ?? list.find(variant => sameLettersAndDays(row.code, variant));
    if (owner !== undefined) byVariant.get(owner)!.push(row);
  }
  return byVariant;
}

/** The lowest price over all the rows, past and full included; Infinity when none has one. */
function lowestPrice(rows: Row[]): number {
  return Math.min(...rows.map(row => row.price ?? Number.POSITIVE_INFINITY));
}

/** The rows' dates, sorted, as one string. */
const dateSet = (rows: Row[]) => [...new Set(rows.map(row => row.date))].sort().join(',');

/**
 * The variant the page gives: the longest that has rows (the longest of all when none has). Among those as long,
 * the choice must stay the same from night to night, since the code is the tour's identity: when they all have
 * rows on exactly the same dates (GSAOA/B/O, cabin grades of one 19-day cruise), the one with the lowest price
 * over all its rows, past and full included (the card shows a "from" price), the first on a tie; otherwise the
 * first. A date passing does not change it; a row added or removed for one grade only, or a new price that
 * reorders the grades, would.
 */
function chosenVariant(list: Variant[], byVariant: Map<Variant, Row[]>): Variant {
  const withRows = list.filter(v => byVariant.get(v)!.length > 0);
  const pool = withRows.length > 0 ? withRows : list;
  const most = longest(pool).days;
  const tied = pool.filter(v => v.days === most);
  if (new Set(tied.map(v => dateSet(byVariant.get(v)!))).size > 1) return tied[0];
  const price = (v: Variant) => lowestPrice(byVariant.get(v)!);
  return tied.reduce((best, v) => (price(v) < price(best) ? v : best));
}

/**
 * One Charming Holidays `?tour=<slug>` page as a ScrapedTour; null when it has no title code, its codes and day
 * counts do not pair up, its table's dated rows are no variant's, or the rows cannot be given to variants of
 * different lengths. A page selling two or more variants (`GERD/E`, 11 or 12 days) gives one (chosenVariant): its
 * code, its day count, its own dates, and the day headings without the days tagged only with other variants' codes.
 * An old post still lists its old dates (a 2023 post: one date, full): normaliseTour skips it as no-departures.
 * `today` (Hong Kong) is used only to tell whether rows that cannot be given to variants of different lengths
 * include one that could be booked; without it every date counts. Every date in the table carries its year.
 */
export function parse(html: string, url: string, today?: IsoDate): ScrapedTour | null {
  const $ = load(html);
  const title = clean($(TITLE).first().text());
  const itinerary = days($);
  const list = variants(title, itinerary.at(-1)?.last ?? null);
  if (list === null) return null;
  const rows = tableRows($);
  const assigned = rowsByVariant(list, rows);
  let variant: Variant;
  let dates: ScrapedDeparture[];
  if (assigned === 'ambiguous') {
    // Rows that cannot be given to variants of different lengths: a failure only if one could be booked. Past
    // or full rows (GAKA/GAKVA's one full date) give the longest variant with no departures (no-departures).
    if (rows.some(row => row.departure !== null && (today === undefined || row.date > today))) return null;
    variant = longest(list);
    dates = [];
  } else {
    // Dated rows, none of them any variant's: the codes are not read as expected.
    if (rows.length > 0 && list.every(v => assigned.get(v)!.length === 0)) return null;
    variant = chosenVariant(list, assigned);
    dates = assigned.get(variant)!.flatMap(row => (row.departure === null ? [] : [row.departure]));
  }

  // A day tagged only with other variants' codes is theirs (GERD's flight home, on a page that sells GERE too).
  const isOurs = (day: Day) => !day.tags.some(tag => list.some(v => sameCode(v.code, tag)))
    || day.tags.some(tag => sameCode(tag, variant.code));
  const headings = itinerary.filter(isOurs).map(day => day.heading);
  const joinedAbroad = $(DAY_TITLE).toArray().some(entry => clean($(entry).find('h3').first().text()).startsWith(GATHERING));
  const first = headings[0] ?? '';
  const last = headings.at(-1) ?? '';
  const startPoint = point(places(first)[0], first, joinedAbroad);
  const endPoint = point(places(last).at(-1), last, joinedAbroad);

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
