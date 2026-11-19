import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../../lib/theme.css';
import { HTML_LANG, makeT, type Locale } from '../../lib/i18n';
import { getTheme } from '../../lib/theme-server';
import { siteMetadata } from '../../lib/site-metadata';
import { I18nProvider } from '../../lib/i18n-client';
import { LanguageNotice } from '../../components/LanguageNotice';
import { SiteNav } from '../../components/SiteNav';
import { Footer } from '../../components/Footer';
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
 * The theme cookie renders every route per request, as the pages already were (requestDb).
 */
export async function SiteFrame({ locale, children }: { locale: Locale; children: ReactNode }) {
  // One locale for the server translator, the client provider and <html lang>, so they cannot disagree.
  const t = makeT(locale);
  // The theme the visitor chose (cookie), on <html> from the first byte so no page paints in the wrong theme;
  // without a choice, no attribute, and theme.css follows the system setting.
  const theme = await getTheme();
  return (
    <html
      lang={HTML_LANG[locale]}
      data-theme={theme ?? undefined}
      className={locale === 'zh-Hant' ? undefined : styles.withNotice}
    >
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
