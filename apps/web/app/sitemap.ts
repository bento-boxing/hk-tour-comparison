import type { MetadataRoute } from 'next';
import { SITE_URL } from '@hktours/core';

/**
 * /sitemap.xml: the site's two pages, by absolute address. No lastModified: the only truthful value (when the
 * tours last changed) would take a database read for every request of this file.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL },
    { url: `${SITE_URL}/chain` },
  ];
}
