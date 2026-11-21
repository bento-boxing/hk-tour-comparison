import type { MetadataRoute } from 'next';
import { places, todayInHongKong } from '@hktours/core';
import { LOCALES } from '../lib/i18n';
import { languageAlternates, localeHref, siteUrl } from '../lib/locale-path';
import { requestDb } from '../lib/db';
import { cachedReads } from '../lib/search-page-data';
import { TOURS_PATH, destinationPath, listedDestinations } from '../lib/destinations';
import { OPERATORS_PATH, isOperatorListed, operatorPath } from '../lib/operators';

/** The site's fixed pages, by path without a language. */
const PAGES = ['/', '/chain', TOURS_PATH, '/about', OPERATORS_PATH] as const;

/**
 * /sitemap.xml: each fixed page, then each destination with a page of its own (lib/destinations.ts isListed: it has
 * tours now, and is no area region and no country's only region), then each operator that lists tours now
 * (lib/operators.ts isOperatorListed), each in the three languages, absolute, with the
 * page's addresses in every language and x-default as alternates (as the pages' own hreflang links). No
 * lastModified: the only truthful value (when the tours last changed) would take another database read.
 *
 * Which destinations and operators have tours are two database reads, through the pages' cache (one entry each per
 * build and day, at most an hour old), so this file is rendered per request (requestDb). When the database cannot be
 * read a read throws and is deliberately not caught: the file answers 500, and a crawler tries again later, instead
 * of reading a short sitemap as every destination or operator page removed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await requestDb();
  const today = todayInHongKong();
  const [counts, operators] = await Promise.all([cachedReads.countToursByDestination(db, today), cachedReads.getOperatorListings(db, today)]);
  const paths = [
    ...PAGES,
    ...listedDestinations(places, counts).map(destinationPath),
    ...operators.filter(isOperatorListed).map(o => operatorPath(o.id)),
  ];
  return paths.flatMap(path => LOCALES.map(locale => ({
    url: siteUrl(localeHref(locale, path)),
    alternates: { languages: languageAlternates(path) },
  })));
}
