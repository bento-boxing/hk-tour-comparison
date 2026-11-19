import type { Metadata } from 'next';
import { SITE_URL } from '@hktours/core';
import type { Locale, T } from './i18n';
import { languageAlternates, localeHref, siteUrl } from './locale-path';

/** Open Graph's locale (language_TERRITORY) for each language. */
const OG_LOCALE: Record<Locale, string> = { 'zh-Hant': 'zh_HK', 'zh-Hans': 'zh_CN', en: 'en_GB' };

/**
 * The root layouts' metadata: the site address that relative addresses are resolved against, the site name as
 * the title with the pattern a page's own title goes into ("連續行程 | 跟邊團"), and the description in the
 * page's language.
 */
export function siteMetadata(t: T): Metadata {
  const siteName = t('site.name');
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: siteName, template: `%s | ${siteName}` },
    description: t('site.description'),
  };
}

/**
 * One page's metadata, in the page's language (`t`): its own title (`name`; none for the home page, which is
 * titled with the site name), its canonical address, the same page in each language, and its Open Graph fields.
 * The canonical address is this language's address of the path alone ('/en/chain'): a filtered, sorted or paged
 * address is the same page, and search engines are kept off query strings (app/robots.ts) because every such
 * address is a function run on Vercel. The alternates (hreflang) are the path in all three languages plus
 * x-default, the unprefixed Traditional Chinese one. All absolute.
 */
export function pageMetadata(t: T, path: '/' | '/chain', name?: string): Metadata {
  const siteName = t('site.name');
  return {
    ...(name !== undefined && { title: name }),
    alternates: { canonical: siteUrl(localeHref(t.locale, path)), languages: languageAlternates(path) },
    // Next.js replaces the layout's openGraph as a whole, so each page gives every field. The title's pattern
    // does not apply to og:title, so it is spelled out. Deliberately no `url` (og:url): Facebook and LinkedIn
    // link a shared post to og:url, so a shared search or chain plan (its state is in the query string) would
    // open as the bare page. Without it, each service keeps the address that was shared.
    openGraph: {
      title: name === undefined ? siteName : `${name} | ${siteName}`,
      description: t('site.description'),
      siteName,
      locale: OG_LOCALE[t.locale],
      type: 'website',
    },
  };
}
