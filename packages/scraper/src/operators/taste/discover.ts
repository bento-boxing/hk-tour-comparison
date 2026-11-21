import { load } from 'cheerio';
import { PUBLIC_LOG, type LogView } from '../../public-log';
import type { Fetcher } from '../../types';
import { TOUR_CODE } from './public';

/**
 * The only three path shapes ever requested on the site (docs/operators/taste.md), all by plain GET with no extra
 * headers, always on `https://tastetravel.com.hk`: the list, `/tour/select/page/<offset>` with offset 0, 10, 20, …
 * until the last page; then for each tour its page, `/tour/detail/tour_id/<n>`, and its dates answer,
 * `/tour/event/tour_id/<n>`, once each. Never `/tour/download/…` or `/tour/whatsapp/…` (the page's script calls them
 * when a visitor clicks, so they count clicks), an itinerary PDF, an image, a search or a booking step (owner decision
 * 2026-11-19: a reduced listing).
 */
const SITE = 'https://tastetravel.com.hk';
/** Cards on one list page. */
const PER_PAGE = 10;
/**
 * A ceiling on list pages (600 entries; the list held 311 on 2026-11-20, 32 pages): a list that still links a next
 * page after this many fails discovery rather than being read without end or cut short.
 */
export const MAX_LIST_PAGES = 60;

/** Every request: a redirect is followed only within https://tastetravel.com.hk; one that leaves it is not requested. */
export const SAME_SITE = { sameOriginRedirectsOnly: true } as const;

/** A tour's id on the site (`693`, `1175`): the only text that goes into a tour's request URLs. */
const TOUR_ID = /^[1-9]\d{0,8}$/;
/** A tour page as tourPageUrl writes it, exactly. */
const TOUR_PAGE = /^https:\/\/tastetravel\.com\.hk\/tour\/detail\/tour_id\/([1-9]\d{0,8})$/;

function checkedId(id: string): string {
  if (!TOUR_ID.test(id)) throw new Error(`not a Taste Travel tour id (${id.length} characters)`);
  return id;
}

/** One list page, by its offset (0, 10, 20, …). */
export function listUrl(offset: number): string {
  if (!Number.isInteger(offset) || offset < 0 || offset % PER_PAGE !== 0) throw new Error('not a list offset');
  return `${SITE}/tour/select/page/${offset}`;
}

/** The tour's page: its facts, its identity in a run and the "view on the operator's site" link. */
export function tourPageUrl(id: string): string {
  return `${SITE}/tour/detail/tour_id/${checkedId(id)}`;
}

/** The tour's dates answer: a JSON array of its departure dates, each with a status. */
export function eventUrl(id: string): string {
  return `${SITE}/tour/event/tour_id/${checkedId(id)}`;
}

/** The tour id of a tour page as tourPageUrl writes it, or null for any other URL. */
export function tourIdOf(url: string): string | null {
  return TOUR_PAGE.exec(url)?.[1] ?? null;
}

export function isTourUrl(url: string): boolean {
  return tourIdOf(url) !== null;
}

/** Why a list entry is not a group tour for us; fixed texts, so a public log can print them. */
export type LeftOut = 'not a tour page link' | 'no tour code' | 'no day count';

export interface ListPage {
  /** The entries that are group tours: a tour page link, a tour code and a day count. In the page's order. */
  tours: { id: string; code: string }[];
  /** The other entries, by why. */
  leftOut: Partial<Record<LeftOut, number>>;
  /** Every entry's link, tours or not, to see a page that repeats earlier ones. */
  links: string[];
  /** Whether the page links a next page (`下一頁`); the last page does not. */
  next: boolean;
  /** The product count the page states (`共為您找到<span>311</span>條商品`), or null. */
  total: number | null;
  /** The page number the pager marks as this page (`<a class="selected">16</a>`), or null. */
  current: number | null;
  /** How many links the pager has (none on a list short enough for one page, presumably). */
  pagerLinks: number;
}

/**
 * A card's title, `CAK03 - <title>`: the tour code (TOUR_CODE, as on the tour page) before ` - `. A code may hold `-`
 * itself (`CAK-03 - <title>`) but no space, so it ends at the first space, and the ` - ` after it is the title's. The
 * title may be empty (`SJS12 - `). The code only tells a group tour from other products: no request URL holds it.
 */
const CARD_CODE = new RegExp(`^(${TOUR_CODE.source})\\s+-(?:\\s|$)`);
const CARD_DAYS = /^(\d+)\s*天$/;
const NEXT_PAGE = '下一頁';

/**
 * One list page's entries. An entry is a group tour when it links a tour page and its card gives a tour code and a
 * day count, as every card seen does (311 products on 2026-11-20; docs/operators/taste.md). Anything else (a
 * ticket, a hotel or a package, should the site list one) is left out and counted by why. Throws, with a fixed text,
 * for a page that is not a list page (a block page, a redesign).
 */
export function readListPage(html: string): ListPage {
  const $ = load(html);
  const box = $('.list-tour-box');
  if (box.length === 0) throw new Error('taste: not a list page');
  const tours: ListPage['tours'] = [];
  const leftOut: ListPage['leftOut'] = {};
  const links: string[] = [];
  const leave = (why: LeftOut) => { leftOut[why] = (leftOut[why] ?? 0) + 1; };
  box.find('a.list-tour').each((_, card) => {
    const href = ($(card).attr('href') ?? '').trim();
    links.push(href);
    const id = tourIdOf(href);
    if (id === null) return leave('not a tour page link');
    const code = CARD_CODE.exec($(card).find('.list-tour-desc-title').first().text().trim())?.[1];
    if (code === undefined) return leave('no tour code');
    const days = CARD_DAYS.exec($(card).find('.desc-day').first().text().trim());
    if (!days || Number(days[1]) < 1) return leave('no day count');
    tours.push({ id, code });
  });
  const pager = $('.list-page-box a').toArray();
  const next = pager.some(link => $(link).text().trim() === NEXT_PAGE);
  const total = /^\d+$/.exec($('.list-num span').first().text().trim())?.[0];
  const current = /^\d+$/.exec($('.list-page-box a.selected').first().text().trim())?.[0];
  return {
    tours, leftOut, links, next,
    total: total === undefined ? null : Number(total),
    current: current === undefined ? null : Number(current),
    pagerLinks: pager.length,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The share of the stated product count the entries read may fall short by before discovery fails: 10%. */
const MAX_SHORTFALL_TENTHS = 1;

/**
 * Every group tour's page, each once, in the list's order: list pages at offsets 0, 10, 20, … until the one with no
 * next-page link. Throws, with a fixed text, when a page is not fetched or not a list page; when a page with entries
 * is not the page its offset asks for, by the pager's current-page marker (the site did not honour the offset, which
 * also checks that `/page/0` is page 1); when a page's entries all appeared on earlier pages; when an empty page still
 * links a next page (only a page with no next link ends the list); when the list still goes on after MAX_LIST_PAGES
 * pages; when it holds no group tour; or when the entries read fall more than 10% short of the product count the
 * first page states. Discovery then fails as `discover-error` and nothing is saved, rather than a list read in part
 * marking the rest inactive. The list is paged by offset, so a tour added or removed during the night can shift an
 * entry onto the next page: a tour seen twice is kept once (and one shifted back onto a page already read is missed
 * that night, so marked inactive). Log lines hold counts and fixed texts only (the public log); `logView` is unused,
 * as no line quotes the site.
 */
export async function discoverTours(
  fetcher: Fetcher, log: (line: string) => void, _logView: LogView = PUBLIC_LOG,
): Promise<string[]> {
  const ids = new Set<string>();
  const seenLinks = new Set<string>();
  const leftOut = new Map<LeftOut, number>();
  let repeated = 0;
  let total: number | null = null;
  let pages = 0;
  let entries = 0;
  for (let page = 0; ; page++) {
    if (page === MAX_LIST_PAGES) throw new Error(`taste: the list goes on past ${MAX_LIST_PAGES} pages`);
    const offset = page * PER_PAGE;
    const html = await fetcher.fetchText(listUrl(offset), SAME_SITE);
    if (html === null) throw new Error(`taste: list page at offset ${offset} was not fetched`);
    const read = readListPage(html);
    pages++;
    if (page === 0) total = read.total;
    if (read.links.length === 0) {
      if (read.next) throw new Error(`taste: list page at offset ${offset} is empty but links a next page`);
      break;
    }
    const onePageList = page === 0 && read.current === null && read.pagerLinks === 0 && !read.next;
    if (read.current !== page + 1 && !onePageList) {
      const marked = read.current === null ? 'no page' : `page ${read.current}`;
      throw new Error(`taste: list page at offset ${offset} is not page ${page + 1} (the pager marks ${marked})`);
    }
    entries += read.links.length;
    if (page > 0 && read.links.every(link => seenLinks.has(link))) {
      throw new Error(`taste: list page at offset ${offset} repeats earlier entries`);
    }
    for (const link of read.links) seenLinks.add(link);
    for (const [why, n] of Object.entries(read.leftOut) as [LeftOut, number][]) leftOut.set(why, (leftOut.get(why) ?? 0) + n);
    for (const { id } of read.tours) {
      if (ids.has(id)) repeated++;
      else ids.add(id);
    }
    if (!read.next) break;
  }
  if (ids.size === 0) throw new Error('taste: the list has no group tour');
  if (total !== null && entries * 10 < total * (10 - MAX_SHORTFALL_TENTHS)) {
    throw new Error(`taste: the list holds ${entries} entries, more than 10% fewer than the ${total} products it states`);
  }

  const leftOutCount = [...leftOut.values()].reduce((sum, n) => sum + n, 0);
  if (leftOutCount > 0) {
    const order: LeftOut[] = ['no tour code', 'no day count', 'not a tour page link'];
    const kinds = order.filter(why => leftOut.has(why)).map(why => `${why} ${leftOut.get(why)}`).join(', ');
    log(`taste: left out ${plural(leftOutCount, 'list entry', 'list entries')} that ${leftOutCount === 1 ? 'is' : 'are'} not ${leftOutCount === 1 ? 'a group tour' : 'group tours'} (${kinds})`);
  }
  if (repeated > 0) log(`taste: ${plural(repeated, 'tour', 'tours')} listed on more than one page, kept once`);
  const stated = total === null ? 'the list gives no product count' : `the list says ${total} products`;
  log(`taste: ${stated}, ${plural(entries, 'entry', 'entries')} found; ${plural(pages, 'page', 'pages')} read, ${plural(ids.size, 'tour', 'tours')}, ${leftOutCount} left out`);
  return [...ids].map(tourPageUrl);
}
