'use client';

import { makeT, type Locale } from '../../lib/i18n';
import frame from './site-frame.module.css';
import styles from './error-page.module.css';

/**
 * The error page inside a language's pages, in that language's frame (app/(zh-hant)/error.tsx, app/zh-hans/error.tsx,
 * app/en/error.tsx): what a page shows when it could not be made, as when the database cannot be read and a stored
 * page (the home page, /tours, /operators) has no stored copy yet. A message naming no tours (the page may be the operators index;
 * in Chinese the same words as the pages' own "cannot read" line), and a button that asks the server for the page
 * again (`retry`, from Next.js). Nothing about the cause is shown.
 *
 * An error boundary is a client component, so this is drawn in the browser. The server answers 500 with Next.js's
 * bare error document (marked noindex, with the page's title but no text): without JavaScript the page stays blank.
 */
export function ErrorPage({ locale, retry }: { locale: Locale; retry: () => void }) {
  const t = makeT(locale);
  return (
    <div className={`${frame.wrap} ${frame.page}`}>
      <div className={styles.error}>
        <h1 className={styles.heading}>{t('error.title')}</h1>
        <p className={styles.text} role="alert">{t('error.text')}</p>
        <button type="button" className={styles.retry} onClick={() => retry()}>{t('error.retry')}</button>
      </div>
    </div>
  );
}
