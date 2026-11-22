import { OPERATOR_IDS, type OperatorId, type PlacesIndex } from '@hktours/core';
import type { OperatorListing } from '@hktours/db/read';
import type { Locale } from './i18n';
import { placeName } from './place-names';
import { buildSearchQuery, searchHref, type SearchState } from './search-params';

// An operator's page is '/operators/<id>' in each language ('/operators/egl', '/en/operators/texpert'): the id the
// whole site uses for it (OPERATOR_IDS, the database's operators.id), so a new operator gets its page with no new
// code. These addresses are permanent once search engines have indexed them.

/** The operators index's path, without a language. */
export const OPERATORS_PATH = '/operators' as const;

/** The operator an id names, exactly as spelled in OPERATOR_IDS; undefined for anything else. */
export function operatorFromId(id: string): OperatorId | undefined {
  return OPERATOR_IDS.find(known => known === id);
}

/** An operator's page ('/operators/egl'). A path without a language: see localeHref. */
export function operatorPath(id: OperatorId): `/operators/${string}` {
  return `${OPERATORS_PATH}/${id}`;
}

/**
 * The address of a search state on an operator's page: the page's own path, plus the query for the other filters
 * (the destination among them, as `dest`), the sort and the page. The operator is the path's: `op` is never in the
 * query, whatever the state says. A path without a language: see localeHref.
 */
export function operatorSearchHref(id: OperatorId, state: SearchState): string {
  const query = buildSearchQuery(state);
  query.delete('op');
  const path = operatorPath(id);
  // Not query.size: Safari before 17, Chrome before 113 and Firefox before 112 lack it (undefined there).
  const q = query.toString();
  return q ? `${path}?${q}` : path;
}

/** How a page turns a search state into an address: an operator's page keeps its own path; every other search page uses searchHref. */
export function stateHrefFor(operator: OperatorId | null): (state: SearchState) => string {
  return operator === null ? searchHref : state => operatorSearchHref(operator, state);
}

/**
 * True for an operator the site shows at all: one that has had a good run. One never scraped (added to the code and
 * the database, but not yet in the nightly run) has no page, no index entry and no sitemap line, as it has no place in
 * the filter bar. The database's listings already leave such operators out (getOperatorListings); the pages check
 * again, so neither can show one by itself.
 */
export function isOperatorShown(listing: Pick<OperatorListing, 'lastGoodRunAt'>): boolean {
  return listing.lastGoodRunAt !== null;
}

/** The operators the site shows (isOperatorShown), in the listings' order. */
export function shownOperators<L extends Pick<OperatorListing, 'lastGoodRunAt'>>(listings: L[]): L[] {
  return listings.filter(isOperatorShown);
}

/** True for an operator with a page for search engines (in the sitemap, not noindex): shown, and listing tours now. */
export function isOperatorListed(listing: Pick<OperatorListing, 'tours' | 'lastGoodRunAt'>): boolean {
  return isOperatorShown(listing) && listing.tours > 0;
}

/** How many countries an operator's description names. */
export const DESCRIPTION_PLACES = 3;

/**
 * The countries an operator's tours go to most, by name in `locale`, at most `n`: its countries in the listing's
 * order (most tours first), skipping any the places data does not know.
 */
export function operatorPlaces(listing: Pick<OperatorListing, 'countries'>, places: PlacesIndex, locale: Locale, n = DESCRIPTION_PLACES): string[] {
  return listing.countries
    .flatMap(({ countryId }) => {
      const country = places.country(countryId);
      return country ? [placeName(country, locale)] : [];
    })
    .slice(0, n);
}

/** How each language writes a list of names: '日本、韓國及台灣', 'Japan, South Korea and Taiwan'. */
const LIST_LOCALE: Record<Locale, string> = { 'zh-Hant': 'zh-Hant-HK', 'zh-Hans': 'zh-Hans', en: 'en-GB' };

/** Names joined as a sentence in `locale` writes them. */
export function joinNames(names: string[], locale: Locale): string {
  return new Intl.ListFormat(LIST_LOCALE[locale], { style: 'long', type: 'conjunction' }).format(names);
}

/**
 * The operator's home address as a link may use it: an absolute http(s) address, as stored; null for anything else
 * (the page then shows no link rather than a broken or unsafe one).
 */
export function officialSiteUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
