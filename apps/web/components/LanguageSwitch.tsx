'use client';

import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { HTML_LANG, LOCALES, type Locale, type T } from '../lib/i18n';
import { HREFLANG, localeHref, splitLocalePath } from '../lib/locale-path';
import styles from './LanguageSwitch.module.css';

/** Each language named in itself, whatever the current one; the short form is for narrow screens. */
export const LANGUAGE_NAMES: Record<Locale, { name: string; short: string }> = {
  'zh-Hant': { name: '繁體中文', short: '繁' },
  'zh-Hans': { name: '简体中文', short: '简' },
  en: { name: 'English', short: 'EN' },
};

/** The three links, to `path` (the page, without its language) plus `query` in each language. */
function LanguageLinks({ t, path, query }: { t: T; path: string; query: string }) {
  const page = query ? `${path}?${query}` : path;
  return (
    <div role="group" aria-label={t('lang.label')} className={styles.group}>
      {LOCALES.map(locale => {
        const { name, short } = LANGUAGE_NAMES[locale];
        return (
          <a
            key={locale}
            href={localeHref(locale, page)}
            lang={HTML_LANG[locale]}
            hrefLang={HREFLANG[locale]}
            aria-label={name}
            aria-current={locale === t.locale ? 'true' : undefined}
            className={styles.option}
          >
            <span className={styles.long}>{name}</span>
            <span className={styles.short} aria-hidden="true">{short}</span>
          </a>
        );
      })}
    </div>
  );
}

/** The links with the address's query string, read with useSearchParams (which suspends: see LanguageSwitch). */
function LanguageLinksWithQuery({ t, path }: { t: T; path: string }) {
  return <LanguageLinks t={t} path={path} query={useSearchParams().toString()} />;
}

/**
 * The language switch in the nav bar: three ordinary links (they work without JavaScript), each to this same page
 * and the same query string (filters, page, chain plan) in one language; the current language is marked
 * aria-current. The page comes from usePathname and the query string from useSearchParams, both from the address
 * the visitor is on, so they follow every client-side navigation (a filter change) at once.
 * Before the page's scripts run, the visible links are the Suspense fallback: the same page in each language
 * WITHOUT the query string. The Suspense boundary is still pending when the server sends the start of the page,
 * so the served HTML shows the fallback; the links with the query string follow later in the same response, in a
 * hidden block that an inline script swaps in. A visitor without JavaScript (or one who taps before the scripts run) therefore reaches the
 * right page in the other language, but with no filters, page number or chain plan. The brief allowed that as
 * the worst case; search engines follow the clean links.
 * Plain <a>, not next/link: a language change is a whole new page (it is also another root layout for Traditional
 * Chinese), and next/link would prefetch the other languages' versions of every page.
 */
export function LanguageSwitch({ t }: { t: T }) {
  const { path } = splitLocalePath(usePathname());
  return (
    <div className={styles.switch}>
      <Suspense fallback={<LanguageLinks t={t} path={path} query="" />}>
        <LanguageLinksWithQuery t={t} path={path} />
      </Suspense>
    </div>
  );
}
