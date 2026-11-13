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
/** Day-1 prose such as `是日集合於香港國際機場，由專業領隊…`: the place up to the first punctuation. */
const GATHERING = /集合於([^，。、；,;\s]{1,20})/;
/** One stop of a stop line: the place, optionally followed by `：` and the activities there. */
const STOP_SEPARATOR = /[~～]/;
const ACTIVITIES = /[：:].*$/;

/** Text without zero-width characters, with runs of whitespace (including no-break spaces) as one space. */
function clean(text: string): string {
  return text.replace(ZERO_WIDTH, '').replace(/\s+/g, ' ').trim();
}

/**
 * A day's stop line, e.g. `哈爾濱 ~ 漠河 ~ 北極村`, without the activity list after a colon.
 * Full-width brackets become ASCII ones because the page mixes them (`(含…）`).
 * Falls back to the day title when the page gives no stop line.
 */
function dayHeading(day: Cheerio<Element>): string {
  const stops = clean(day.find('.day--trip-work').first().text()) || clean(day.find('.day--title').first().text());
  return stops
    .replace(/（/g, '(').replace(/）/g, ')')
    .split(STOP_SEPARATOR)
    .map(stop => stop.replace(ACTIVITIES, '').trim())
    .filter(stop => stop !== '')
    .join(' ~ ');
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

/** One Jetour `/tour/<CODE>` page as a ScrapedTour; null when it has no tour code or day count. */
export function parse(html: string, url: string, today: IsoDate = todayInHongKong()): ScrapedTour | null {
  const $ = load(html);
  const code = clean($('.tour_location .card_tag').first().text());
  if (code === '') return null;

  const title = clean($('h1.title').first().text());
  const dayItems = $('.days__list--works .days__items').toArray().map(element => $(element));
  const days = Number(DAYS_IN_TITLE.exec(title)?.[1] ?? dayItems.length);
  if (!(days > 0)) return null;

  const firstDayDetails = dayItems.length > 0 ? clean(dayItems[0].find('.days_items--details').text()) : '';

  return {
    operatorId: 'jetour',
    code,
    url: url.replace(/[?#].*$/, ''),
    title,
    days,
    nights: null,
    dayHeadings: dayItems.map(dayHeading),
    startPoint: GATHERING.exec(firstDayDetails)?.[1] ?? null,
    endPoint: null,
    fromPriceHkd: parsePriceHkd(clean($('.booking--price').first().text())),
    departures: departures($, today),
  };
}
