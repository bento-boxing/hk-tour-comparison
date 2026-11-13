import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../lib/theme.css';
import { getLocale, getT } from '../lib/i18n';
import { I18nProvider } from '../lib/i18n-client';
import { SiteNav } from '../components/SiteNav';
import { Footer } from '../components/Footer';
import styles from './layout.module.css';

export function generateMetadata(): Metadata {
  return { title: getT()('site.name') };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const t = getT();
  return (
    // Always zh-Hant: developer English mode changes the text only.
    <html lang="zh-Hant">
      <body>
        <I18nProvider locale={getLocale(process.env)}>
          <SiteNav />
          <main className={styles.content}>{children}</main>
          <Footer t={t} />
        </I18nProvider>
      </body>
    </html>
  );
}
