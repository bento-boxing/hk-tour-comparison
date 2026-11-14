import type { Fetcher } from '../../types';

const ORIGIN = 'https://www.charming-online.com';
/** Posts per list page: the most WordPress gives. 789 tour posts on 2026-11-13 took 8 pages. */
export const PER_PAGE = 100;
/** A ceiling on list pages (2,000 posts): a list said to be longer fails discovery rather than being cut short. */
export const MAX_LIST_PAGES = 20;
/**
 * `?tour=<slug>`: one tour post. Slugs are the brochure code (`f-26-mono-008-ghtg`) or, on older posts, a
 * percent-encoded Chinese title (`6%e5%a4%a9…-gdxd`). Only these characters, so no slug can change the path.
 */
const TOUR_QUERY = /(?:^\?|&)tour=([A-Za-z0-9%_-]+)(?=&|$)/;
/** robots.txt disallows `/?page_id=2101`; no tour page uses `page_id`, so any URL that has one is not a tour page. */
const PAGE_ID = /(?:^\?|&)page_id=/;
/**
 * Posts that are not group tours, by their decoded slug (all 24 such posts were parse failures in the
 * 2026-11-14 practice crawl): spa and wellness packages priced in the slug (`…單人價錢：5100…`) and a membership
 * (`臻林-悅康會籍`); air tickets (`機票及郵輪套票`, `加拿大航空《溫哥華機票-1晚酒店》…`); Peace Boat world cruises
 * (`122回-100-日-…`); and cruise-only packages counted in nights (`9-晚-希臘精選之旅《海洋奧德賽號》`, `2-3晚三亞海上遊…`).
 * They are not fetched.
 */
const NOT_A_GROUP_TOUR = /價錢|會籍|機票|^\d+回-|^\d+(?:-\d+)?-?晚/;

/**
 * One page of the site's WordPress REST list of tour posts (newest first), with only the fields asked for.
 * The tour pages link it as their JSON alternate; robots.txt allows it (docs/operators/charming.md).
 */
export function listUrl(page: number): string {
  return `${ORIGIN}/index.php?rest_route=/wp/v2/tour&per_page=${PER_PAGE}&_fields=id,slug,link,modified&_envelope&page=${page}`;
}

/** True for a post whose slug says it is not a group tour (see NOT_A_GROUP_TOUR). */
export function isNotAGroupTour(url: string): boolean {
  const slug = TOUR_QUERY.exec(url.slice(url.indexOf('?')))?.[1];
  if (slug === undefined) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return false;
  }
  return NOT_A_GROUP_TOUR.test(decoded);
}

/** The page's URL as `https://www.charming-online.com/?tour=<slug>`, or null if it is not a tour page. */
export function tourPageUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== ORIGIN || parsed.pathname !== '/' || PAGE_ID.test(parsed.search)) return null;
  const slug = TOUR_QUERY.exec(parsed.search)?.[1];
  return slug === undefined ? null : `${ORIGIN}/?tour=${slug}`;
}

/** True for a tour page on https://www.charming-online.com. */
export function isTourUrl(url: string): boolean {
  return tourPageUrl(url) !== null;
}

interface ListPage { posts: unknown[]; totalPages: unknown }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * One list page, asked for with `_envelope` (a documented WordPress REST parameter): the answer is always
 * `{"body": …, "status": …, "headers": {…}}`, so the HTTP status and `X-WP-TotalPages` come in the text the
 * fetcher returns. Throws when the page was not fetched, is not that envelope, or its status is not 200 with a
 * list of posts: a list read in part would deactivate the tours on the missing pages.
 */
async function readPage(fetcher: Fetcher, page: number): Promise<ListPage> {
  const text = await fetcher.fetchText(listUrl(page));
  if (text === null) throw new Error(`charming: REST list page ${page} was not fetched`);
  let envelope: unknown;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error(`charming: REST list page ${page} is not JSON`);
  }
  if (!isObject(envelope) || envelope.status !== 200 || !Array.isArray(envelope.body)) {
    const status = isObject(envelope) ? JSON.stringify(envelope.status) : 'none';
    throw new Error(`charming: REST list page ${page} is not a list of posts (status ${status})`);
  }
  const headers = isObject(envelope.headers) ? envelope.headers : {};
  const name = Object.keys(headers).find(key => key.toLowerCase() === 'x-wp-totalpages');
  return { posts: envelope.body, totalPages: name === undefined ? undefined : headers[name] };
}

/** The list's page count from page 1's `X-WP-TotalPages` (a number, or digits); throws unless 1..MAX_LIST_PAGES. */
function pageCount(value: unknown): number {
  const count = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
    throw new Error(`charming: REST list gives no page count (X-WP-TotalPages ${JSON.stringify(value)})`);
  }
  if (count > MAX_LIST_PAGES) {
    throw new Error(`charming: REST list has ${count} pages, more than the ${MAX_LIST_PAGES} read`);
  }
  return count;
}

/**
 * Every tour page the REST list links, each once, newest post first, except posts that are not group tours
 * (NOT_A_GROUP_TOUR). Page 1 gives the page count; every page up to it must answer, or discovery throws (the
 * run then fails as `discover-error` and last night's tours stay). Many posts are old tours with no dates left;
 * their pages are still fetched, and skipped as no-departures.
 */
export async function discover(fetcher: Fetcher): Promise<string[]> {
  const first = await readPage(fetcher, 1);
  const total = pageCount(first.totalPages);
  const pages = [first];
  for (let page = 2; page <= total; page++) pages.push(await readPage(fetcher, page));

  const tours = new Set<string>();
  for (const post of pages.flatMap(page => page.posts)) {
    const link = isObject(post) ? post.link : undefined;
    const tour = typeof link === 'string' ? tourPageUrl(link) : null;
    if (tour !== null && !isNotAGroupTour(tour)) tours.add(tour);
  }
  return [...tours];
}
