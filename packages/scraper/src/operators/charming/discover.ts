import type { Fetcher } from '../../types';

const ORIGIN = 'https://www.charming-online.com';
/** Posts per list page: the most WordPress gives. 789 tour posts on 2026-11-13 took 8 pages. */
export const PER_PAGE = 100;
/** A ceiling on list pages (2,000 posts), so a list that never shrinks cannot keep the run asking. */
export const MAX_LIST_PAGES = 20;
/**
 * `?tour=<slug>`: one tour post. Slugs are the brochure code (`f-26-mono-008-ghtg`) or, on older posts, a
 * percent-encoded Chinese title (`6%e5%a4%a9…-gdxd`). Only these characters, so no slug can change the path.
 */
const TOUR_QUERY = /(?:^\?|&)tour=([A-Za-z0-9%_-]+)(?=&|$)/;
/** robots.txt disallows `/?page_id=2101`; no tour page uses `page_id`, so any URL that has one is not a tour page. */
const PAGE_ID = /(?:^\?|&)page_id=/;

/**
 * One page of the site's WordPress REST list of tour posts (newest first), with only the fields asked for.
 * The tour pages link it as their JSON alternate; robots.txt allows it (docs/operators/charming.md).
 */
export function listUrl(page: number): string {
  return `${ORIGIN}/index.php?rest_route=/wp/v2/tour&per_page=${PER_PAGE}&_fields=id,slug,link,modified&page=${page}`;
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

/** The posts of one list page, or null when the answer is not a JSON list. */
function posts(text: string): unknown[] | null {
  try {
    const data: unknown = JSON.parse(text);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Every tour page the REST list links, each once, newest post first. The list is read page by page until a
 * page holds fewer than PER_PAGE posts. A page that is not fetched, or not a JSON list, also ends it: WordPress
 * refuses a page past the last (HTTP 400), which is the only end a list of exactly 100, 200… posts has.
 * Many posts are old tours with no dates left; their pages are still fetched, and skipped as no-departures.
 */
export async function discover(fetcher: Fetcher): Promise<string[]> {
  const tours = new Set<string>();
  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const text = await fetcher.fetchText(listUrl(page));
    const list = text === null ? null : posts(text);
    if (list === null) break;
    for (const post of list) {
      const link = typeof post === 'object' && post !== null ? (post as { link?: unknown }).link : undefined;
      const tour = typeof link === 'string' ? tourPageUrl(link) : null;
      if (tour !== null) tours.add(tour);
    }
    if (list.length < PER_PAGE) break;
  }
  return [...tours];
}
