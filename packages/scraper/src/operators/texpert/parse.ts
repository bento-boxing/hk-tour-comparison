import { load, type CheerioAPI } from 'cheerio';
import { isIsoDate, parsePriceHkd, type IsoDate, type ScrapedDeparture, type ScrapedTour } from '@hktours/core';

// Sources: docs/operators/texpert.md, "Where each fact comes from".
// HTML: title (`h1`), day headings (`details summary h3`). JSON-LD: days, "from" price.
// Next.js flight data: tour code, departure dates and prices (also the fallback for days and price).

type JsonObject = Record<string, unknown>;

/** One `self.__next_f.push([1,"…"])` script; the captured part is a JSON string literal. */
const FLIGHT_CHUNK = /^\s*self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)\s*;?\s*$/s;
/** `T<hex byte length>,` after a row id: a text row, whose text has no closing newline. */
const TEXT_ROW = /^T([0-9a-f]+),/;
const COLON = 0x3a;
const NEWLINE = 0x0a;
/** A departure date, optionally followed by a time. */
const ISO_DATE = /^(\d{4}-\d{2}-\d{2})(?:T|$)/;
/** Highlighted-date types that mean the date cannot be booked (seen so far: `HotRecommended`, `AlreadyFormed`). */
const FULL_TYPE = /full|sold\s*out/i;
const DAY_LABEL = /^day\s*\d+$/i;
const SEGMENT_SEPARATOR = /[→>＞]/;
const BRACKETED = /\([^)]*\)|（[^）]*）|【[^】]*】|\[[^\]]*\]/g;
const GATHERING = '集合';
const DISMISSAL = /解散|散團/;
const MAX_POINT_LENGTH = 20;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

/** Text with runs of whitespace (including no-break spaces) as one space. */
function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Every object inside a JSON value, in document order. */
function* objectsIn(value: unknown): Generator<JsonObject> {
  if (Array.isArray(value)) {
    for (const item of value) yield* objectsIn(item);
  } else if (isObject(value)) {
    yield value;
    for (const item of Object.values(value)) yield* objectsIn(item);
  }
}

/** The page's flight data: the decoded strings of its `self.__next_f.push([1,…])` scripts, joined. Never run. */
function flightPayload($: CheerioAPI): string {
  let payload = '';
  $('script').each((_, script) => {
    const chunk = FLIGHT_CHUNK.exec($(script).html() ?? '');
    if (!chunk) return;
    try {
      const text: unknown = JSON.parse(chunk[1]);
      if (typeof text === 'string') payload += text;
    } catch {
      // Not a JSON string literal: not data this parser can read.
    }
  });
  return payload;
}

/**
 * The JSON values of the flight data's rows (`<id>:<JSON>\n`). Text rows (`<id>:T<hex>,<text>`) give their
 * length in UTF-8 bytes and have no newline, so the payload is walked as bytes. Rows that are not JSON are skipped.
 */
function flightValues(payload: string): unknown[] {
  const bytes = Buffer.from(payload, 'utf8');
  const values: unknown[] = [];
  let at = 0;
  while (at < bytes.length) {
    const colon = bytes.indexOf(COLON, at);
    const newline = bytes.indexOf(NEWLINE, at);
    if (colon === -1) break;
    if (newline !== -1 && newline < colon) {
      at = newline + 1;
      continue;
    }
    const text = TEXT_ROW.exec(bytes.subarray(colon + 1, colon + 20).toString('latin1'));
    if (text) {
      at = colon + 1 + text[0].length + parseInt(text[1], 16);
      continue;
    }
    const end = newline === -1 ? bytes.length : newline;
    const body = bytes.subarray(colon + 1, end).toString('utf8');
    if (body.startsWith('[') || body.startsWith('{')) {
      try {
        values.push(JSON.parse(body));
      } catch {
        // A malformed row: skip it.
      }
    }
    at = end + 1;
  }
  return values;
}

interface Flight {
  /** The tour header's props: `{"code":"TDZC05R","departures":[…],"duration":5,"minSalePrice":999,…}`. */
  tour: JsonObject | null;
  /** The booking sidebar's props: `{"isSoldOut":false,"isPurchasable":true,"products":[{"prices":[…]}],…}`. */
  booking: JsonObject | null;
}

function readFlight($: CheerioAPI): Flight {
  const flight: Flight = { tour: null, booking: null };
  for (const value of flightValues(flightPayload($))) {
    for (const object of objectsIn(value)) {
      if (flight.tour === null && typeof object.code === 'string' && object.code.trim() !== '' && 'duration' in object) {
        flight.tour = object;
      }
      if (flight.booking === null && Array.isArray(object.products)) flight.booking = object;
    }
    if (flight.tour !== null && flight.booking !== null) break;
  }
  return flight;
}

/** The JSON-LD item typed `TouristTrip` (the 2nd `ld+json` script on a tour page), or null. */
function touristTrip($: CheerioAPI): JsonObject | null {
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    let data: unknown;
    try {
      data = JSON.parse($(script).html() ?? '');
    } catch {
      continue;
    }
    for (const item of asArray(data).flatMap(entry => (isObject(entry) && '@graph' in entry ? asArray(entry['@graph']) : [entry]))) {
      if (isObject(item) && asArray(item['@type']).includes('TouristTrip')) return item;
    }
  }
  return null;
}

/** A positive whole number of days, or null. */
function dayCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function jsonLdDays(trip: JsonObject | null): number | null {
  const property = asArray(trip?.additionalProperty)
    .find(p => isObject(p) && p.propertyID === 'tourDurationDays');
  return isObject(property) ? dayCount(property.value) : null;
}

/** A price given as a JSON number (or, in JSON-LD, a numeric string), as whole HKD; null below 100 or if absent. */
function price(value: unknown, allowText = false): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return parsePriceHkd(String(Math.trunc(value)));
  if (allowText && typeof value === 'string') return parsePriceHkd(value);
  return null;
}

/** JSON-LD `offers`: `AggregateOffer.lowPrice`, or `Offer.price` when every date costs the same. */
function jsonLdFromPrice(trip: JsonObject | null): number | null {
  const offer = asArray(trip?.offers).find(isObject);
  if (!offer) return null;
  return price(offer.lowPrice, true) ?? price(offer.price, true);
}

/** True when the tour as a whole cannot be booked: sold out (`售罄`), purchase paused, or ended. */
function isClosed(flight: Flight): boolean {
  return [flight.tour, flight.booking].some(o =>
    o !== null && (o.isSoldOut === true || o.isPurchasable === false || o.isExpired === true));
}

/** Every bookable date in `products[].prices[]`, with its `sellingPrice` (the service fee is charged on top). */
function departures(flight: Flight): ScrapedDeparture[] {
  if (flight.booking === null || isClosed(flight)) return [];
  const fullDates = new Set(asArray(flight.tour?.departures)
    .filter(isObject)
    .filter(d => typeof d.type === 'string' && FULL_TYPE.test(d.type))
    .map(d => d.date));
  const result: ScrapedDeparture[] = [];
  for (const product of asArray(flight.booking.products).filter(isObject)) {
    for (const row of asArray(product.prices).filter(isObject)) {
      const date = typeof row.date === 'string' ? ISO_DATE.exec(row.date)?.[1] : undefined;
      if (date === undefined || !isIsoDate(date) || fullDates.has(date)) continue;
      if (typeof row.inventory === 'number' && row.inventory <= 0) continue;
      result.push({ date, priceHkd: price(row.sellingPrice) });
    }
  }
  return result;
}

/** Each `details summary h3` without its `Day N` label element, e.g. `福田口岸集合 (乘地鐵) 深圳北站 > …`. */
function dayHeadings($: CheerioAPI): string[] {
  return $('details summary h3').toArray()
    .map(h3 => {
      const heading = $(h3).clone();
      heading.find('*').filter((_, element) => DAY_LABEL.test(clean($(element).text()))).remove();
      return clean(heading.text());
    })
    .filter(heading => heading !== '');
}

/** A heading segment without bracketed notes or spaces (the page breaks words with spaces: `散 團`). */
function compact(segment: string): string {
  return segment.replace(BRACKETED, '').replace(/\s+/g, '');
}

/** The place before the marker in a heading segment, if it is short enough to be a place name. */
function placeBefore(segment: string, at: number): string | null {
  const place = segment.slice(0, at);
  const length = [...place].length;
  return length > 0 && length <= MAX_POINT_LENGTH ? place : null;
}

/** Day 1 starts with the meeting point: `福田口岸集合 (乘地鐵) 深圳北站 > …` gives `福田口岸`. */
function gatheringPoint(firstHeading: string | undefined): string | null {
  const segment = (firstHeading ?? '').split(SEGMENT_SEPARATOR).map(compact).find(s => s.includes(GATHERING));
  return segment === undefined ? null : placeBefore(segment, segment.indexOf(GATHERING));
}

/** The last day ends with the dismissal point: `… > (地鐵) 福田/羅湖口岸解散` gives `福田/羅湖口岸`. */
function dismissalPoint(lastHeading: string | undefined): string | null {
  const segment = (lastHeading ?? '').split(SEGMENT_SEPARATOR).map(compact).reverse().find(s => DISMISSAL.test(s));
  return segment === undefined ? null : placeBefore(segment, segment.search(DISMISSAL));
}

/**
 * One Travel Expert `/zh-hk/tour/<id>-<slug>` page as a ScrapedTour; null when it has no tour code or day count.
 * `_today` is accepted for the shared parser signature; every date on these pages carries its year.
 */
export function parse(html: string, url: string, _today?: IsoDate): ScrapedTour | null {
  const $ = load(html);
  const flight = readFlight($);
  const code = typeof flight.tour?.code === 'string' ? flight.tour.code.trim() : '';
  if (code === '') return null;

  const trip = touristTrip($);
  const days = jsonLdDays(trip) ?? dayCount(flight.tour?.duration);
  if (days === null) return null;

  const flightTitle = typeof flight.tour?.title === 'string' ? clean(flight.tour.title) : '';
  const headings = dayHeadings($);

  return {
    operatorId: 'texpert',
    code,
    url: url.replace(/[?#].*$/, ''),
    title: clean($('h1').first().text()) || flightTitle,
    days,
    nights: null,
    dayHeadings: headings,
    startPoint: gatheringPoint(headings[0]),
    endPoint: dismissalPoint(headings.at(-1)),
    fromPriceHkd: jsonLdFromPrice(trip) ?? price(flight.tour?.minSalePrice),
    departures: departures(flight),
  };
}
