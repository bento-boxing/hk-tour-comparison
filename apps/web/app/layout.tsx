import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../lib/theme.css';
import { getLocale, getT, makeT } from '../lib/i18n';
import { I18nProvider } from '../lib/i18n-client';
import { SiteNav } from '../components/SiteNav';
import { Footer } from '../components/Footer';
import styles from './layout.module.css';

export function generateMetadata(): Metadata {
  return { title: getT()('site.name') };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // One locale for both the server translator and the client provider, so they cannot disagree.
  const locale = getLocale(process.env);
  const t = makeT(locale);
  return (
    // Always zh-Hant: developer English mode changes the text only.
    <html lang="zh-Hant">
      <body>
        <I18nProvider locale={locale}>
          <SiteNav />
          <main className={styles.content}>{children}</main>
          <Footer t={t} />
        </I18nProvider>
      </body>
    </html>
  );
}
