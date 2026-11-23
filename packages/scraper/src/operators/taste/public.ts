import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { collapseWhitespaceNfc } from '../shared/text';

/**
 * The allow-list: the only parts of Taste Travel's answers this scraper keeps (docs/operators/taste.md, "Where each
 * fact comes from"). The tour page also has the description, highlights, tags, fee notes, booking notes, remarks, a
 * WhatsApp link, the PDF link and scripts; the dates answer also has colours. None of those is kept. fetch-page.ts
 * applies this to every answer before anything else sees it, and the committed fixtures are made with it.
 */

/** The title. */
export const TITLE = '.detail-name';
/** `團號：CAK03`. */
export const NUMBER = '.detail-number';
/** Holds NUMBER and the days line, `行程天數：3天`. */
export const PRODUCT_INFO = '.detail-day';
/** `HKD<span>699</span> 起`: the "from" price. */
export const FROM_PRICE = '.detail-price .tig';
/** One per day, in order: the day's places, joined by `→` or `⇨`. */
export const DAY_LINE = '#tour_days_detail .detail-desc-day-box .detail-desc-desc';
/** The booking notes: the first of the two elements with this id (the second is the remarks). */
export const NOTICE = '[id="tour_notice"] .detail-desc-text';

/** `行程天數：3天`. */
export const DAYS_LINE = /行程天數\s*[:：]\s*\d+\s*天/;
/** The gathering point's label in the booking notes. */
export const GATHERING_LABEL = '集合時間地點';
/** `A: <time> <place>`: one of several gathering options, each on its own line after the label. */
const OPTION = /^[A-Z]\s*[:：.．、]\s*/;
/** `早上 07:30AM`, `下午 1:30PM`, `09:30`: a time before an option's place. */
const TIME = /(?:早上|上午|中午|下午|晚上|凌晨)?\s*\d{1,2}\s*[:：]\s*\d{2}\s*(?:[AaPp][Mm])?/g;
/** What ends an option's place: a bracketed note, directions (`出門後…`), a sentence. */
const PLACE_END = /【|出門|，|,|。|；|;|\*/;
const MAX_PLACE_LENGTH = 40;

/** An element's text, a `<br>` read as a line break. */
function linesOf($: CheerioAPI, element: Cheerio<AnyNode>): string[] {
  if (element.length === 0) return [];
  return (element.html() ?? '').split(/<br\s*\/?>/i).map(part => collapseWhitespaceNfc(load(part, null, false).root().text()));
}

/** An element's text on one line, a `<br>` read as a space. */
export function textOf($: CheerioAPI, element: Cheerio<AnyNode>): string {
  return collapseWhitespaceNfc(linesOf($, element).join(' '));
}

/** One gathering option's place: without its letter, its time, and anything after the place. */
function optionPlace(line: string): string {
  const place = collapseWhitespaceNfc(line.replace(OPTION, '').replace(TIME, ' ').split(PLACE_END)[0]);
  return [...place].slice(0, MAX_PLACE_LENGTH).join('');
}

/**
 * The gathering options in the booking notes' lines: the text after `集合時間地點` on its own line
 * (`集合時間地點 : 香港國際機場`), else each option line right after it (`A: <time> <place>`, `B: …`), as places.
 * Empty when there is no label, or nothing after it.
 */
export function gatheringOptions(lines: string[]): string[] {
  const at = lines.findIndex(line => line.includes(GATHERING_LABEL));
  if (at < 0) return [];
  const own = collapseWhitespaceNfc(lines[at].slice(lines[at].indexOf(GATHERING_LABEL) + GATHERING_LABEL.length).replace(/^[\s:：]+/, ''));
  const options: string[] = [];
  if (own !== '') options.push(optionPlace(own));
  else for (const line of lines.slice(at + 1)) {
    if (!OPTION.test(line)) break;
    options.push(optionPlace(line));
  }
  return [...new Set(options.filter(place => place !== ''))];
}

/** The booking notes' lines (`<br>`-separated). */
export function noticeLines(html: string): string[] {
  const $ = load(html, null, false);
  return linesOf($, $.root());
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The tour page cut to what the parser reads, as text only: the title, the code, the days line, the "from" price,
 * each day's line, and the gathering options (each as its place, see gatheringOptions). '' for a page that has none
 * of these (a block page).
 */
export function publicTourPage(html: string): string {
  const $ = load(html);
  const parts: string[] = [];
  const title = $(TITLE).first();
  if (title.length > 0) parts.push(`<div class="detail-name">${escape(textOf($, title))}</div>`);
  const info = $(PRODUCT_INFO).first();
  const number = info.find(NUMBER).first();
  const days = info.children().toArray().map(child => textOf($, $(child))).find(text => DAYS_LINE.test(text));
  if (number.length > 0 || days !== undefined) {
    parts.push('<div class="detail-day">'
      + (number.length > 0 ? `<div class="detail-number">${escape(textOf($, number))}</div>` : '')
      + (days !== undefined ? `<div>${escape(days)}</div>` : '')
      + '</div>');
  }
  const price = $(FROM_PRICE).first().find('span').first();
  if (price.length > 0) parts.push(`<div class="detail-price"><div class="tig">HKD<span>${escape(textOf($, price))}</span> 起</div></div>`);
  const dayLines = $(DAY_LINE).toArray().map(line => textOf($, $(line)));
  if (dayLines.length > 0) {
    parts.push('<div id="tour_days_detail">'
      + dayLines.map(line => `<div class="detail-desc-day-box"><div class="detail-desc-desc">${escape(line)}</div></div>`).join('')
      + '</div>');
  }
  const notice = $(NOTICE).first();
  const options = notice.length > 0 ? gatheringOptions(linesOf($, notice)) : [];
  if (options.length > 0) {
    const letters = options.map((place, i) => `${String.fromCharCode(65 + i)}: ${escape(place)}`);
    parts.push(`<div id="tour_notice"><div class="detail-desc-text">${GATHERING_LABEL}<br>${letters.join('<br>')}</div></div>`);
  }
  return parts.join('\n');
}

/** A tour code (`CAK03`): plain letters, digits, `_` and `-`, 1 to 40 of them. The same on a list card (discover.ts). */
export const TOUR_CODE = /[A-Za-z0-9_-]{1,40}/;
/** `團號：CAK03`: the tour code. */
const CODE = new RegExp(`^團號\\s*[:：]\\s*(${TOUR_CODE.source})$`);

/** The tour code of a page (raw or trimmed), or null. */
export function codeOf(html: string): string | null {
  const $ = load(html);
  return CODE.exec(textOf($, $(PRODUCT_INFO).first().find(NUMBER).first()))?.[1] ?? null;
}

/**
 * The dates answer's statuses, all bookable (docs/operators/taste.md): 已成團 (confirmed to depart), 快成團 (nearly
 * confirmed), 收客中 (taking bookings). The site shows no full or closed marker; a date with any other status is
 * skipped (and logged by fetchPage), so such a marker, should one appear, is never shown as bookable.
 */
export const BOOKABLE_STATUSES: readonly string[] = ['已成團', '快成團', '收客中'];

export function isBookable(status: string): boolean {
  return BOOKABLE_STATUSES.includes(collapseWhitespaceNfc(status));
}

/** One element of the dates answer: its date and status, as text ('' when not text). */
export interface PublicDate { date: string; title: string }

/**
 * The dates answer's dates and statuses, or null when it is not a JSON array. It is served as text/html and the
 * site's own script runs it with `eval`; here it is only ever parsed as JSON.
 */
export function publicDates(text: string): PublicDate[] | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(value)) return null;
  return value.map(item => {
    const entry = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
    return {
      date: typeof entry.date === 'string' ? entry.date.trim() : '',
      title: typeof entry.title === 'string' ? collapseWhitespaceNfc(entry.title) : '',
    };
  });
}
