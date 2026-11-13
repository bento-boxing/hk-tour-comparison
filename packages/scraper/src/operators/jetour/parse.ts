import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import {
  isIsoDate, parsePriceHkd, todayInHongKong,
  type IsoDate, type ScrapedDeparture, type ScrapedTour,
} from '@hktours/core';

// Selectors and formats: docs/operators/jetour.md, "Where each fact comes from".

/** Status classes of a booking row that mean the date cannot be booked. Any other status counts as open. */
const FULL_STATUS_CLASSES = new Set(['FULLED']);
const FULL_STATUS_TEXT = '額滿';
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const DAYS_IN_TITLE = /^(\d+)\s*天/;
/** `2026年12月22日 (二)`; the year is optional. */
const DATE = /(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日/;
const PRICE = /HKD\s*(\d[\d,]*)/;
/** Day-1 prose such as `是日集合於香港國際機場，由專業領隊…`: the place follows `集合於`… */
const GATHERING = '集合於';
/** …and ends at punctuation, a space, or the verb that starts the rest of the sentence. */
const GATHERING_END = /[，。；,;、 ]|由|乘|出發|辦理/;
const MAX_GATHERING_LENGTH = 12;
/** One stop of a stop line: the place, optionally followed by `：` and the activities there. */
const STOP_SEPARATOR = /[~～]/;
const ACTIVITIES = /[：:].*$/;
const BRACKETED = /\([^)]*\)/g;
/** `杭州/上海`: either city, as in a flight leg into or out of one of two airports. */
const EITHER_OR = /^[^/]+(?:\/[^/]+)+$/;
const HONG_KONG = '香港';

/** Text without zero-width characters, with runs of whitespace (including no-break spaces) as one space. */
function clean(text: string): string {
  return text.replace(ZERO_WIDTH, '').replace(/\s+/g, ' ').trim();
}

/**
 * A day's stops, e.g. `哈爾濱 ~ 漠河 ~ 北極村`, without bracketed notes or the activity list after a colon.
 * Brackets may be half- or full-width, even mixed (`(含…）`). Falls back to the day title when the page gives no stop line.
 */
function dayStops(day: Cheerio<Element>): string[] {
  const line = clean(day.find('.day--trip-work').first().text()) || clean(day.find('.day--title').first().text());
  return line
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(BRACKETED, ' ')
    .split(STOP_SEPARATOR)
    .map(stop => clean(stop.replace(ACTIVITIES, '')))
    .filter(stop => stop !== '');
}

/** Removes the stop at `index` if there is one and it is an either/or leg (`杭州/上海`). */
function withoutEitherOr(stops: string[], index: number): string[] {
  return index >= 0 && EITHER_OR.test(stops[index] ?? '') ? stops.filter((_, i) => i !== index) : stops;
}

/**
 * One heading per day. The flight leg next to Hong Kong on day 1 (`香港 ~ 杭州/上海 ~ …`) and on the
 * last day (`… ~ 杭州/上海 ~ 香港`) names two possible airports, not two stops, so it is dropped there.
 */
function dayHeadings(days: Cheerio<Element>[]): string[] {
  const last = days.length - 1;
  return days.map((day, i) => {
    let stops = dayStops(day);
    if (i === 0 && stops.includes(HONG_KONG)) stops = withoutEitherOr(stops, stops.indexOf(HONG_KONG) + 1);
    if (i === last && stops.includes(HONG_KONG)) stops = withoutEitherOr(stops, stops.lastIndexOf(HONG_KONG) - 1);
    return stops.join(' ~ ');
  });
}

/** The place after `集合於` in the text, at most 12 characters; null when the text names none. */
function gatheringPoint(text: string): string | null {
  const at = text.indexOf(GATHERING);
  if (at === -1) return null;
  const place = [...text.slice(at + GATHERING.length).split(GATHERING_END)[0].trim()]
    .slice(0, MAX_GATHERING_LENGTH).join('');
  return place === '' ? null : place;
}

/** `YYYY-MM-DD`; a date without a year is its nearest occurrence on or after today. */
function departureDate(text: string, today: IsoDate): IsoDate | null {
  const match = DATE.exec(text);
  if (!match) return null;
  const [, year, month, day] = match;
  const monthDay = `${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  let date = `${year ?? today.slice(0, 4)}-${monthDay}`;
  if (year === undefined && date < today) date = `${Number(today.slice(0, 4)) + 1}-${monthDay}`;
  return isIsoDate(date) ? date : null;
}

function isFull(row: Cheerio<Element>): boolean {
  const status = row.find('.booking-table--status.visible-desktop').first();
  const statusClass = (status.attr('class') ?? '').trim().split(/\s+/).at(-1) ?? '';
  return FULL_STATUS_CLASSES.has(statusClass) || clean(status.text()).includes(FULL_STATUS_TEXT);
}

/** The row's offer price: the desktop price cell without its struck-through original. */
function rowPrice(row: Cheerio<Element>): number | null {
  const cell = row.find('.booking-table--price.visible-desktop').first().clone();
  cell.find('.text-decoration-line-through').remove();
  const match = PRICE.exec(clean(cell.text()));
  return match ? parsePriceHkd(match[1]) : null;
}

function departures($: CheerioAPI, today: IsoDate): ScrapedDeparture[] {
  const result: ScrapedDeparture[] = [];
  $('.booking-table--body .booking-table--row').each((_, element) => {
    const row = $(element);
    const date = departureDate(clean(row.find('.booking-table--start--date span:last-child').first().text()), today);
    if (date === null || isFull(row)) return;
    result.push({ date, priceHkd: rowPrice(row) });
  });
  return result;
}

/** One Jetour `/tour/<CODE>` page as a ScrapedTour; null when it has no tour code, no day count, or two that disagree. */
export function parse(html: string, url: string, today: IsoDate = todayInHongKong()): ScrapedTour | null {
  const $ = load(html);
  const code = clean($('.tour_location .card_tag').first().text());
  if (code === '') return null;

  const title = clean($('h1.title').first().text());
  const dayItems = $('.days__list--works .days__items').toArray().map(element => $(element));
  const titleDays = DAYS_IN_TITLE.exec(title)?.[1];
  const days = titleDays === undefined ? dayItems.length : Number(titleDays);
  if (!(days > 0)) return null;
  if (dayItems.length > 0 && dayItems.length !== days) return null; // title and itinerary disagree

  const firstDayDetails = dayItems.length > 0 ? clean(dayItems[0].find('.days_items--details').text()) : '';

  return {
    operatorId: 'jetour',
    code,
    url: url.replace(/[?#].*$/, ''),
    title,
    days,
    nights: null,
    dayHeadings: dayHeadings(dayItems),
    startPoint: gatheringPoint(firstDayDetails),
    endPoint: null,
    fromPriceHkd: parsePriceHkd(clean($('.booking--price').first().text())),
    departures: departures($, today),
  };
}
