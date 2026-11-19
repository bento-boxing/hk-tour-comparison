import type { MetadataRoute } from 'next';
import { LOCALES } from '../lib/i18n';
import { languageAlternates, localeHref, siteUrl } from '../lib/locale-path';

/** The site's pages, by path without a language. */
const PAGES = ['/', '/chain'] as const;

/**
 * /sitemap.xml: each page in each of the three languages (six addresses), absolute, each with the page's
 * addresses in every language and x-default as alternates (as the pages' own hreflang links). No lastModified:
 * the only truthful value (when the tours last changed) would take a database read for every request of this file.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(path => LOCALES.map(locale => ({
    url: siteUrl(localeHref(locale, path)),
    alternates: { languages: languageAlternates(path) },
  })));
}
