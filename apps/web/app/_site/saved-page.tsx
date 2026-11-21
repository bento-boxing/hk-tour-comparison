import type { Metadata } from 'next';
import { makeT, type Locale } from '../../lib/i18n';
import { pageMetadata } from '../../lib/site-metadata';
import { SavedConnected } from '../../components/SavedConnected';
import { loadSaved, queryOf, type SearchParams } from './page-data';
import frame from './site-frame.module.css';
import styles from './saved-page.module.css';

/**
 * Titled 已收藏的旅行團 (the layout's pattern adds the site name), and always noindex: the list is the visitor's own
 * (or a link's), not a page for search engines; it is not in the sitemap either.
 */
export function savedPageMetadata(locale: Locale): Metadata {
  const t = makeT(locale);
  return pageMetadata(t, '/saved', { title: t('saved.title'), noindex: true });
}

/**
 * The saved page in `locale` (app/(zh-hant)/saved/page.tsx, app/zh-hans/saved/page.tsx, app/en/saved/page.tsx): the
 * tours this browser saved, as the same rows as the search page. The browser keeps the list (lib/saved-tours.ts) and
 * puts it in the address (`t`: lib/saved-list.ts), which is how this server page learns which tours to read (the
 * cached getToursByKeys; nothing about the visitor is stored here). What the browser holds is compared with the
 * address after hydration (SavedConnected). Rendered per request; a result shown is at most an hour old.
 */
export async function SavedPage({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = makeT(locale);
  const load = await loadSaved(queryOf(await searchParams));
  return (
    <div className={`${frame.wrap} ${frame.page}`}>
      <h1 className={styles.heading}>{t('saved.title')}</h1>
      <p className={styles.intro}>{t('saved.intro')}</p>
      {load.ok ? (
        <SavedConnected {...load.data} today={load.today} now={load.now} />
      ) : (
        // Missing DATABASE_URL or an unreachable database: the visitor gets a short message, the log gets the cause.
        <p className={styles.error} role="alert">{t('search.error')}</p>
      )}
    </div>
  );
}
