import { load } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { isObject } from '../shared/json';

/**
 * The allow-list: the only parts of Sunflower's answers this scraper keeps (docs/operators/sunflower.md, "Where
 * each fact comes from"). The listing also sends marketing text (`SubTitle`, `Description`, `TourMainTourName`,
 * `promotext`), images, PDF links and brochure dates; the booking page also has the description, the promotion
 * notes of each date, scripts and the booking form. None of those is kept. discover.ts and fetch-page.ts apply
 * this to every answer before anything else sees it, and the committed fixtures are made with it.
 */

type Plain = string | number | null;

/** One listing entry's public facts, as plain values (anything else becomes '' or null). */
export interface PublicEntry {
  /** The tour code; '' when the entry has no online booking. */
  ItinCode: string;
  /** The title; it may hold HTML (`<br>`). */
  Title: string;
  /** The operator's sales grouping (`日韓`, `中國長線`, …): never a stop. */
  region: string;
  /** Country or province (`韓國`, `廣東省`): the route's fallback. */
  area: string;
  /** Cities or areas (`釜山、慶州`): the route. */
  subarea: string;
  /** The "from" price before discount (a number), and after it (a number, and as text). */
  minprice: Plain; discount: Plain; discounttext: Plain;
  /** Later dates with a status, `D/M,D/M,…`, at most 6, then `...`. */
  tdp_confirm: Plain; tdp_hardpush: Plain;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const plain = (value: unknown): Plain =>
  (typeof value === 'string' || value === null || (typeof value === 'number' && Number.isFinite(value)) ? value : null);

export function publicEntry(row: unknown): PublicEntry {
  const r = isObject(row) ? row : {};
  return {
    ItinCode: text(r.ItinCode), Title: text(r.Title), region: text(r.region), area: text(r.area), subarea: text(r.subarea),
    minprice: plain(r.minprice), discount: plain(r.discount), discounttext: plain(r.discounttext),
    tdp_confirm: plain(r.tdp_confirm), tdp_hardpush: plain(r.tdp_hardpush),
  };
}

/** The days tag (`#5天團`). */
export const DAYS = '#Content_lbtnday';
/** The one-month departure calendar. */
export const CALENDAR = '#Content_cdrDateOfDeparture';
/** Inside CALENDAR: the month heading (`2026年12月`). */
export const MONTH = 'td[width="70%"]';
/** Inside a calendar cell: its price (`$2,999起`, `$2,999+`). */
export const PRICE = 'span.price';
/** Elements whose text the parser reads; every other text in the kept elements is dropped. */
const READ_TEXT = `${DAYS}, ${MONTH}, ${PRICE}`;
/** Inside the kept elements, never read: promotion notes, holiday names, statuses, the month links (postbacks). */
const DROPPED = '.promotext, .holitext, span:not(.price), a, script, style, img';
const KEPT_ATTRIBUTES = new Set(['id', 'class', 'onclick', 'width']);

/**
 * The booking page cut to what the parser reads: the days tag and the calendar, with each cell's class, date link
 * and price and the month heading, and no other text or attribute. '' for a page that has neither.
 */
export function publicBookingPage(html: string): string {
  const $ = load(html);
  const parts: string[] = [];
  for (const selector of [DAYS, CALENDAR]) {
    const kept = $(selector).first();
    if (kept.length === 0) continue;
    kept.find(DROPPED).remove();
    kept.find('*').addBack().each((_, el) => {
      for (const name of Object.keys((el as Element).attribs ?? {})) if (!KEPT_ATTRIBUTES.has(name)) $(el).removeAttr(name);
    });
    const unread = (node: AnyNode) => node.type === 'text' && $(node.parent as Element).closest(READ_TEXT).length === 0;
    kept.find('*').addBack().contents().filter((_, node) => unread(node)).remove();
    parts.push($.html(kept));
  }
  return parts.join('\n');
}
