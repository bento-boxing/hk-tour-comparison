import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../../lib/theme.css';
import { HTML_LANG, makeT, type Locale } from '../../lib/i18n';
import { siteMetadata } from '../../lib/site-metadata';
import { I18nProvider } from '../../lib/i18n-client';
import { LanguageNotice } from '../../components/LanguageNotice';
import { SiteNav } from '../../components/SiteNav';
import { Footer } from '../../components/Footer';
import { SiteTabBar } from '../../components/TabBar';
import { ThemeScript } from '../../components/ThemeScript';
import styles from './site-frame.module.css';

/**
 * The root layouts' metadata: the site address that relative addresses are resolved against, the site name as
 * the title with the pattern a page's own title goes into, and the description, in `locale`.
 */
export function siteFrameMetadata(locale: Locale): Metadata {
  return siteMetadata(makeT(locale));
}

/**
 * Every page's frame (<html> to the footer), in the language of the address: the root layouts give it
 * (app/(zh-hant)/layout.tsx for the unprefixed addresses, app/zh-hans/layout.tsx and app/en/layout.tsx).
 * Nothing in it depends on the request: the theme is the browser's (the script in <head> sets <html data-theme>
 * from the visitor's stored choice before the first paint; suppressHydrationWarning lets React accept that
 * attribute), so the HTML is the same for every visitor.
 */
export function SiteFrame({ locale, children }: { locale: Locale; children: ReactNode }) {
  // One locale for the server translator, the client provider and <html lang>, so they cannot disagree.
  const t = makeT(locale);
  return (
    <html lang={HTML_LANG[locale]} className={locale === 'zh-Hant' ? undefined : styles.withNotice} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <I18nProvider locale={locale}>
          <LanguageNotice t={t} />
          <SiteNav />
          {/* Full width: each page puts its content in the frame's .wrap (the band spans the window). */}
          <main className={styles.main}>{children}</main>
          <Footer t={t} />
          {/* Phones only: the bottom bar, with a spacer of its height after the footer. */}
          <SiteTabBar />
        </I18nProvider>
      </body>
    </html>
  );
}
