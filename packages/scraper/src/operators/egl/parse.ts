import { load, type CheerioAPI } from 'cheerio';
import {
  isIsoDate, parsePriceHkd, TOUR_CODE_PATTERN,
  type IsoDate, type ScrapedDeparture, type ScrapedTour,
} from '@hktours/core';

// Sources: docs/operators/egl.md, "Where each fact comes from".
// Page HTML: tour code (`[data-tour-code]`), day count (hero `6天．`), day plans (a JSON attribute),
// start and end places (the transport blocks). JSON-LD: title, "from" price.
// The dates JSON (a second request, see fetch-page.ts): departure dates, prices, full and offline flags.

type JsonObject = Record<string, unknown>;

const CODE_ELEMENT = '.block-item--daily-itinerary-calendar-picker[data-tour-code]';
const HERO_PRICE = '.block-item--itinerary-hero-price';
const DAY_PLANS = '.block-item--daily-itinerary-plan-accordion';
const DAY_PLANS_ATTRIBUTE = 'data-daily-itinerary-plans-json';
/** `6天．` (with a full-width full stop) in the hero line. */
const HERO_DAYS = /(\d+)\s*天/;
const OUTBOUND = '出發交通資料';
const INBOUND = '回程交通資料';
/** A transport block's places: origin and destination of each leg, in order. */
const TRANSPORT_PLACE = 'p.egl-h5';
const BRACKETED = /\([^)]*\)|（[^）]*）/g;
/** A note marker on a stop (`香港〔註〕`, `佛牙寺〔註1〕`). */
const NOTE = /〔[^〕]*〕/g;
/** `大阪/東京`: either city, as in a flight leg into or out of one of two airports. */
const EITHER_OR = /^[^/／]+(?:[/／][^/／]+)+$/;
const HONG_KONG = '香港';
const STOP_SEPARATOR = ' → ';
/** A departure date, optionally followed by a time. */
const ISO_DATE = /^(\d{4}-\d{2}-\d{2})(?:T|$)/;
const CURRENCY = 'HKD';

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Text with runs of whitespace (including no-break spaces) as one space. */
function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parseJson(text: string | null | undefined): unknown {
  if (text === null || text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function tourCode($: CheerioAPI): string | null {
  const code = ($(CODE_ELEMENT).first().attr('data-tour-code') ?? '').trim();
  return TOUR_CODE_PATTERN.test(code) ? code : null;
}

/** The tour code the page states, or null when it states none (or one that is not a valid code). */
export function pageTourCode(html: string): string | null {
  return tourCode(load(html));
}

/** The first JSON-LD item typed `Product`, or null. */
function product($: CheerioAPI): JsonObject | null {
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    const data = parseJson($(script).html());
    for (const item of Array.isArray(data) ? data : [data]) {
      if (isObject(item) && item['@type'] === 'Product') return item;
    }
  }
  return null;
}

/** A positive whole number of days, or null. */
function dayCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/** A price given as a JSON number (or numeric text when allowed), as whole HKD; null below 100 or if absent. */
function price(value: unknown, allowText = false): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return parsePriceHkd(String(Math.trunc(value)));
  if (allowText && typeof value === 'string') return parsePriceHkd(value);
  return null;
}

interface DayPlan {
  dayNumber: number; title: string; stops: string[];
  /** True when the day lists a meal or a hotel (any text in `breakfast`, `lunch`, `dinner` or `accomodation`). */
  hasMealsOrHotel: boolean;
}

/** The fields of a day plan that hold its meals and hotel (HTML; `accomodation` is the site's spelling). */
const MEAL_AND_HOTEL_FIELDS = ['breakfast', 'lunch', 'dinner', 'accomodation'] as const;

/** True when the HTML value has any text once its tags are removed. */
function hasText(value: unknown): boolean {
  return typeof value === 'string' && clean(value.replace(/<[^>]*>/g, '')) !== '';
}

/** The day plans in day order, or null when the attribute is missing or not a JSON array. */
function dayPlans($: CheerioAPI): DayPlan[] | null {
  const data = parseJson($(DAY_PLANS).first().attr(DAY_PLANS_ATTRIBUTE));
  if (!Array.isArray(data)) return null;
  return data.filter(isObject)
    .map(plan => ({
      dayNumber: dayCount(plan.dayNumber) ?? 0,
      title: typeof plan.title === 'string' ? clean(plan.title) : '',
      stops: asArray(plan.journeyTextRows).flatMap(row => asArray(row))
        .map(stop => (isObject(stop) && typeof stop.location === 'string' ? clean(stop.location.replace(NOTE, '')) : ''))
        .filter(stop => stop !== ''),
      hasMealsOrHotel: MEAL_AND_HOTEL_FIELDS.some(field => hasText(plan[field])),
    }))
    .sort((a, b) => a.dayNumber - b.dayNumber);
}

/** `【ASCB08】`: a day written for one variant of an itinerary shared by two tours, named by its code without the first two letters. */
const VARIANT_TAG = /^【([A-Z0-9]{4,8})】\s*/;

function variantTag(plan: DayPlan): string | null {
  return VARIANT_TAG.exec(plan.title)?.[1] ?? VARIANT_TAG.exec(plan.stops[0] ?? '')?.[1] ?? null;
}

/**
 * This tour's days of an itinerary shared by two variants (HTASCB08 and HTASCB10 list one plan, with day 8
 * given twice, tagged `【ASCB08】` and `【ASCB10】`). Only when a day is tagged with this tour's code: days tagged
 * with another code are dropped, the tag is removed, and the untagged days after the hero day count (the
 * longer variant's) are dropped; null when there is no hero day count to cut at. Any other plan list is
 * returned unchanged.
 */
function ownVariant(plans: DayPlan[], code: string, days: number | null): DayPlan[] | null {
  const tags = plans.map(variantTag);
  const ours = (tag: string | null) => tag !== null && code.endsWith(tag);
  if (!tags.some(ours)) return plans;
  if (days === null) return null; // which untagged days are this tour's cannot be told
  const untag = (text: string) => text.replace(VARIANT_TAG, '');
  return plans
    .filter((plan, i) => (tags[i] === null ? days === null || plan.dayNumber <= days : ours(tags[i])))
    .map(plan => ({ ...plan, title: untag(plan.title), stops: plan.stops.map(untag).filter(stop => stop !== '') }));
}

/**
 * The plans without a closing arrival day: when the flight home lands after midnight, the page adds a day
 * after the tour's last (`平安抵港` and a note), with no meal and no hotel. Dropped only when it is the one
 * day past the hero day count and the day before ends at home (Hong Kong or the stated end point);
 * anything else is left for the day-count check.
 */
function withoutArrivalDay(plans: DayPlan[], days: number | null, end: string | null): DayPlan[] {
  const last = plans.at(-1);
  const beforeLast = plans.at(-2);
  if (days === null || last === undefined || beforeLast === undefined) return plans;
  const homeAt = beforeLast.stops.at(-1);
  const endsAtHome = homeAt !== undefined && (homeAt === HONG_KONG || homeAt === end);
  const isArrival = last.dayNumber === days + 1 && beforeLast.dayNumber === days && endsAtHome && !last.hasMealsOrHotel;
  return isArrival ? plans.slice(0, -1) : plans;
}

/** The places of the transport block under the heading (`出發交通資料` or `回程交通資料`), in order. */
function transportPlaces($: CheerioAPI, heading: string): string[] {
  const label = $('[data-hiifly-fill-tile] > p').filter((_, p) => clean($(p).text()) === heading).first();
  return label.parent().next().find(TRANSPORT_PLACE).toArray()
    .map(p => clean($(p).text()))
    .filter(place => place !== '');
}

/** A start or end place without its bracketed notes (`深圳羅湖口岸(地面)門前廣場(EGL旗號集合)` → `深圳羅湖口岸門前廣場`). */
function point(place: string | undefined): string | null {
  if (place === undefined) return null;
  return clean(place.replace(BRACKETED, '')) || null;
}

/** Removes the stop at `index` if there is one and it is an either/or leg (`大阪/東京`). */
function withoutEitherOr(stops: string[], index: number): string[] {
  return index >= 0 && EITHER_OR.test(stops[index] ?? '') ? stops.filter((_, i) => i !== index) : stops;
}

/**
 * One heading per day: its stops joined with arrows, or its title when it lists no stops. The flight leg
 * next to the home place (Hong Kong, or the stated start or end) on day 1 and on the last day may name two
 * possible airports (`香港 → 大阪/東京 → …`), not two stops, so it is dropped there.
 */
function dayHeadings(plans: DayPlan[], start: string | null, end: string | null): string[] {
  const last = plans.length - 1;
  return plans.map((plan, i) => {
    let stops = plan.stops;
    if (i === 0) {
      const home = stops.findIndex(stop => stop === HONG_KONG || stop === start);
      if (home !== -1) stops = withoutEitherOr(stops, home + 1);
    }
    if (i === last) {
      const fromEnd = [...stops].reverse().findIndex(stop => stop === HONG_KONG || stop === end);
      if (fromEnd !== -1) stops = withoutEitherOr(stops, stops.length - 1 - fromEnd - 1);
    }
    return stops.length > 0 ? stops.join(STOP_SEPARATOR) : plan.title;
  });
}

interface Dates { departures: ScrapedDeparture[]; fromPriceHkd: number | null }

/**
 * The dates JSON (`{"data":{"productCode","currency","sellingPrice","dates":[…]}}`) for the tour `code`:
 * every date not marked `isFull` or `isOffline` (the site's calendar lets neither be chosen), with its
 * `sellingPrice`. No departures for the successful "No Available Dates" answer (empty code, currency and dates).
 * null when it is not that JSON, or otherwise does not say it is for this tour and in HKD.
 */
function readDates(datesJson: string | null, code: string): Dates | null {
  const response = parseJson(datesJson);
  const data = isObject(response) ? response.data : undefined;
  if (!isObject(data) || !Array.isArray(data.dates)) return null;
  // A tour with nothing on sale is answered with an empty code and currency (`status: "No Available Dates"`).
  const noDates = isObject(response) && response.isSuccess === true && data.status === 'No Available Dates'
    && data.dates.length === 0 && data.productCode === '' && data.currency === '';
  if (noDates) return { departures: [], fromPriceHkd: null };
  if (data.productCode !== code || data.currency !== CURRENCY) return null;
  const departures: ScrapedDeparture[] = [];
  for (const row of data.dates.filter(isObject)) {
    const date = typeof row.departureDate === 'string' ? ISO_DATE.exec(row.departureDate)?.[1] : undefined;
    if (date === undefined || !isIsoDate(date) || row.isFull === true || row.isOffline === true) continue;
    departures.push({ date, priceHkd: price(row.sellingPrice) });
  }
  return { departures, fromPriceHkd: price(data.sellingPrice) };
}

/**
 * One EGL `/website/itinerary/<CODE>` page and its dates JSON as a ScrapedTour; null when the page has no
 * tour code or day count, its day counts disagree (after dropping another variant's days and a closing
 * arrival day), or the dates JSON is missing or not for this tour.
 * `_today` is accepted for the shared parser signature; every date in the dates JSON carries its year.
 */
export function parse(html: string, datesJson: string | null, url: string, _today?: IsoDate): ScrapedTour | null {
  const $ = load(html);
  const code = tourCode($);
  if (code === null) return null;
  const dates = readDates(datesJson, code);
  if (dates === null) return null;

  const listed = dayPlans($);
  if (listed === null) return null;
  const hero = HERO_DAYS.exec(clean($(`p:has(> ${HERO_PRICE})`).first().text()))?.[1];
  const heroDays = hero !== undefined ? Number(hero) : null;
  const own = ownVariant(listed, code, heroDays);
  if (own === null) return null;
  const endPoint = point(transportPlaces($, INBOUND).at(-1));
  const plans = withoutArrivalDay(own, heroDays, endPoint);
  const planDays = plans.length > 0 ? plans[plans.length - 1].dayNumber : 0;
  const days = heroDays ?? planDays;
  if (!(days > 0)) return null;
  if (planDays > 0 && planDays !== days) return null; // hero and itinerary disagree

  const trip = product($);
  const startPoint = point(transportPlaces($, OUTBOUND)[0]);

  return {
    operatorId: 'egl',
    code,
    url: url.replace(/[?#].*$/, ''),
    title: typeof trip?.name === 'string' ? clean(trip.name) : '',
    days,
    nights: null,
    dayHeadings: dayHeadings(plans, startPoint, endPoint),
    startPoint,
    endPoint,
    fromPriceHkd: price(isObject(trip?.offers) ? trip.offers.price : undefined, true) ?? dates.fromPriceHkd,
    departures: dates.departures,
  };
}
