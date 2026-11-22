import { HTML_LANG, type T } from './i18n';
import { localeHref, siteUrl } from './locale-path';
import type { SitePath } from './site-metadata';

// Structured data (JSON-LD, schema.org) for search engines, built only from what the page itself shows: the site's
// name and address, and each page's place in the site (its breadcrumb trail). Server code only (siteUrl reads
// SITE_URL). Rendered by components/JsonLd.tsx, one script per type per page.
//
// Deliberately absent (task 64): no Organization for any operator (the site is not theirs and has not checked their
// details), no Offer, Product, AggregateRating or FAQPage (the site sells nothing, rates nothing and has no
// questions and answers), and no ItemList of the tours: the rows show no tour name to give an item, link off the site
// (Google's list results want each item's own page on the same site), are one sorted page of a longer list, and in
// the browser hide a departure that has gone by since the page was made, so a list in the HTML could name rows the
// visitor no longer sees.

/** A JSON-LD object: schema.org's vocabulary, with @context on the outermost object. */
export type JsonLdObject = { '@context': 'https://schema.org'; '@type': string } & Record<string, unknown>;

/**
 * The site as a whole, in the page's language: its name (跟邊團 in every language), an alternate name in that
 * language, its home page's address in that language, and the language. Only each language's home page gives it
 * (app/_site/search-page.tsx SearchView), where Google reads a site's name.
 */
export function websiteJsonLd(t: T): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: t('site.name'),
    alternateName: t('site.alternateName'),
    url: siteUrl(localeHref(t.locale, '/')),
    inLanguage: HTML_LANG[t.locale],
  };
}

/** One step of a breadcrumb trail: the name the page shows for it and its path without a language. */
export interface Crumb { name: string; path: SitePath }

/**
 * A page's place in the site as a breadcrumb trail, in the page's language: the home page, then each step of the
 * path, ending with the page itself. Every step names its absolute address in that language.
 */
export function breadcrumbJsonLd(t: T, crumbs: Crumb[]): JsonLdObject {
  const trail: Crumb[] = [{ name: t('site.name'), path: '/' }, ...crumbs];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: siteUrl(localeHref(t.locale, crumb.path)),
    })),
  };
}

/**
 * JSON-LD as the text of its script element (components/JsonLd.tsx): JSON, with every '<', '>' and '&' (and the two
 * line separators) written as a \u escape, so no value (a place or operator name from the data) can end the script
 * or start another tag. JSON.parse reads the escapes back as the same characters.
 */
export function jsonLdText(data: JsonLdObject): string {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
