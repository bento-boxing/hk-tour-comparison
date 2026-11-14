import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../lib/theme.css';
import { HTML_LANG, makeT } from '../lib/i18n';
import { getLocale, getT } from '../lib/i18n-server';
import { I18nProvider } from '../lib/i18n-client';
import { LanguageNotice } from '../components/LanguageNotice';
import { SiteNav } from '../components/SiteNav';
import { Footer } from '../components/Footer';
import styles from './layout.module.css';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('site.name') };
}

/**
 * Every page's frame, in the visitor's language (the language switch's cookie; Traditional Chinese without
 * one). Reading the cookie renders every route per request, as the pages already were for the latest scrape.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  // One locale for the server translator, the client provider and <html lang>, so they cannot disagree.
  const locale = await getLocale();
  const t = makeT(locale);
  return (
    <html lang={HTML_LANG[locale]} className={locale === 'zh-Hant' ? undefined : styles.withNotice}>
      <body>
        <I18nProvider locale={locale}>
          <LanguageNotice t={t} />
          <SiteNav />
          <main className={styles.content}>{children}</main>
          <Footer t={t} />
        </I18nProvider>
      </body>
    </html>
  );
}
