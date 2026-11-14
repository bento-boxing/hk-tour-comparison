import {
  isIsoDate, parsePriceHkd, TOUR_CODE_PATTERN,
  type IsoDate, type ScrapedDeparture, type ScrapedTour,
} from '@hktours/core';
import { tourIdOf } from './discover';
import { splitTour } from './fetch-page';
import { routeChunks } from './public';

// Sources: docs/operators/bigline.md, "Where each fact is in the API". The text is fetchPage's join of the
// tour detail and one dates answer per month requested. Only the paths below are read; the API's other
// fields (tour leaders, staff notes, suppliers, costs) never are, even in an answer that was not trimmed.

type JsonObject = Record<string, unknown>;

const OK = 200;
const CURRENCY = 'HKD';
const STOP_SEPARATOR = ' → ';
/** In `tourFlag` (`"1,2,5"`): seen on every full departure and on no open one. */
const FULL_FLAG = '5';
/** `registrationStatus` 1: seen on every full departure (0 on every open one). */
const REGISTRATION_CLOSED = 1;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const objectAt = (value: unknown): JsonObject => (isObject(value) ? value : {});
const arrayAt = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/** Text with runs of whitespace (line breaks included) as one space. */
function clean(text: unknown): string {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
}

/** A price given as a JSON number (`6199.0`), as whole HKD; null below 100 or if absent. */
function price(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? parsePriceHkd(String(Math.trunc(value))) : null;
}

/** True when the id (a number or digits as text) is this tour's. */
const sameId = (value: unknown, id: string) =>
  (typeof value === 'number' || typeof value === 'string') && String(value) === id;

/**
 * True for a departure that cannot be booked. The site's own rule was not read (docs/operators/bigline.md),
 * so this is the conservative reading: full when ANY marker seen on the full departures is present (no seats
 * left, or no seat count at all; as many sold as it holds; registration closed; the full flag), or it is
 * cut off. `tourStatus` and `releaseStatusDaily` are not read: their meanings are unknown.
 */
function isFullOrClosed(row: JsonObject): boolean {
  if (!isCount(row.seatRemain) || row.seatRemain <= 0) return true;
  if (isCount(row.soldTotal) && isCount(row.maxPersonTotal) && row.soldTotal >= row.maxPersonTotal) return true;
  if (row.registrationStatus === REGISTRATION_CLOSED) return true;
  if (typeof row.tourFlag === 'string' && row.tourFlag.split(',').map(flag => flag.trim()).includes(FULL_FLAG)) return true;
  return row.isCutofftour === true;
}

/**
 * Every bookable departure of the months' answers, in the order given, with its member price; or why there
 * are none to read (an answer carries an error code or has no list, or lists a departure that is not this
 * tour's). Past dates are kept: normaliseTour drops them.
 */
function readDepartures(months: { dates: unknown }[], id: string): ScrapedDeparture[] | string {
  const departures: ScrapedDeparture[] = [];
  for (const { dates } of months) {
    const answer = objectAt(dates);
    const list = objectAt(answer.data).list;
    if (answer.code !== OK || !Array.isArray(list)) return 'a dates answer has an error code or no list';
    for (const row of list.map(objectAt)) {
      if (!sameId(row.productId, id)) return 'a dates answer lists a departure of another tour';
      const date = row.scheduleDate;
      if (typeof date !== 'string' || !isIsoDate(date) || isFullOrClosed(row)) continue;
      departures.push({ date, priceHkd: price(row.memberFee) });
    }
  }
  return departures;
}

/** One heading per day, in day order: the day's route chunks joined with arrows. */
function dayHeadings(itinerary: unknown): string[] {
  return arrayAt(objectAt(itinerary).dailyTripList).map(objectAt)
    .map(day => ({ day: isCount(day.days) ? day.days : 0, heading: routeChunks(day.tripContent).join(STOP_SEPARATOR) }))
    .sort((a, b) => a.day - b.day)
    .map(({ heading }) => heading);
}

/** The first gathering place the detail lists, or null. */
function gatheringPlace(signUp: JsonObject): string | null {
  for (const place of arrayAt(signUp.locationGroupList)) {
    const name = clean(objectAt(place).locationName);
    if (name !== '') return name;
  }
  return null;
}

/**
 * One Big Line tour (fetchPage's text for `https://bigline.hk/tour-group/<id>`) as a ScrapedTour, or why it is
 * not one. The reasons are fixed texts, never anything from the answer, so they can be logged.
 */
export function readTour(text: string, url: string): ScrapedTour | { why: string } {
  const id = tourIdOf(url);
  if (id === null) return { why: 'not a Big Line tour page' };
  const tour = splitTour(text);
  if (tour === null) return { why: 'not the joined detail and dates text' };
  const detail = objectAt(tour.detail);
  const data = objectAt(detail.data);
  if (detail.code !== OK) return { why: 'the detail answered a code other than 200' };
  if (!sameId(data.id, id)) return { why: 'the detail is for another tour' };

  const basic = objectAt(data.basic);
  const code = clean(basic.tourNo);
  if (!TOUR_CODE_PATTERN.test(code)) return { why: 'the detail has no valid tour code' };
  const days = basic.tourDays;
  if (!isCount(days) || days < 1) return { why: 'the detail has no day count of at least 1' };
  const signUp = objectAt(data.signUp);
  if (signUp.settlementCurrencyCode !== CURRENCY) return { why: 'the prices are not in HKD' };
  const departures = readDepartures(tour.months, id);
  if (typeof departures === 'string') return { why: departures };

  return {
    operatorId: 'bigline',
    code,
    url: url.replace(/[?#].*$/, ''),
    title: clean(basic.nameCn),
    days,
    nights: null,
    dayHeadings: dayHeadings(data.projectItinerary),
    startPoint: gatheringPlace(signUp),
    endPoint: null,
    fromPriceHkd: price(data.memberFee),
    departures,
  };
}

/**
 * One Big Line tour as a ScrapedTour; null when it is not one (see readTour for the reasons). `_today` is
 * accepted for the shared parser signature; every date carries its year.
 */
export function parse(text: string, url: string, _today?: IsoDate): ScrapedTour | null {
  const tour = readTour(text, url);
  return 'why' in tour ? null : tour;
}
