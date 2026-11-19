import type { MetadataRoute } from 'next';
import { places, todayInHongKong } from '@hktours/core';
import { LOCALES } from '../lib/i18n';
import { languageAlternates, localeHref, siteUrl } from '../lib/locale-path';
import { requestDb } from '../lib/db';
import { cachedReads } from '../lib/search-page-data';
import { TOURS_PATH, destinationPath, listedDestinations } from '../lib/destinations';

/** The site's fixed pages, by path without a language. */
const PAGES = ['/', '/chain', TOURS_PATH, '/about'] as const;

/**
 * /sitemap.xml: each fixed page, then each destination with a page of its own (lib/destinations.ts isListed: it has
 * tours now, and is no area region and no country's only region), each in the three languages, absolute, with the
 * page's addresses in every language and x-default as alternates (as the pages' own hreflang links). No
 * lastModified: the only truthful value (when the tours last changed) would take another database read.
 *
 * Which destinations have tours is a database read, through the pages' cache (one entry per build and day, at most
 * an hour old), so this file is rendered per request (requestDb). When the database cannot be read the read throws
 * and is deliberately not caught: the file answers 500, and a crawler tries again later, instead of reading a short
 * sitemap as every destination page removed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const counts = await cachedReads.countToursByDestination(await requestDb(), todayInHongKong());
  const paths = [...PAGES, ...listedDestinations(places, counts).map(destinationPath)];
  return paths.flatMap(path => LOCALES.map(locale => ({
    url: siteUrl(localeHref(locale, path)),
    alternates: { languages: languageAlternates(path) },
  })));
}
