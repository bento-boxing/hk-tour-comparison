import type { Metadata } from 'next';
import { SITE_URL } from '@hktours/core';
import type { Locale, T } from './i18n';

/** Open Graph's locale (language_TERRITORY) for each language. */
const OG_LOCALE: Record<Locale, string> = { 'zh-Hant': 'zh_HK', 'zh-Hans': 'zh_CN', en: 'en_GB' };

/**
 * The root layout's metadata: the site address that relative addresses (canonical, og:url) are resolved
 * against, the site name as the title with the pattern a page's own title goes into ("連續行程 | 跟邊團"), and
 * the description in the visitor's language.
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
 * One page's metadata: its own title (`name`; none for the home page, which is titled with the site name), its
 * canonical address, and its Open Graph fields in the visitor's language. The canonical address is the path
 * alone: a filtered, sorted or paged address is the same page, and search engines are kept off query strings
 * (app/robots.ts) because every such address is a function run on Vercel.
 */
export function pageMetadata(t: T, path: '/' | '/chain', name?: string): Metadata {
  const siteName = t('site.name');
  return {
    ...(name !== undefined && { title: name }),
    alternates: { canonical: path },
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
