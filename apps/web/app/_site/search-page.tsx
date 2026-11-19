import type { Metadata } from 'next';
import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { todayInHongKong } from '@hktours/core';
import { makeT, type Locale } from '../../lib/i18n';
import { pageMetadata } from '../../lib/site-metadata';
import { requestDb } from '../../lib/db';
import { cachedReads, loadSearchPage, type SearchPageData } from '../../lib/search-page-data';
import { DestinationPanelsConnected, DestinationSearchConnected } from '../../components/DestinationConnected';
import { FilterBarConnected } from '../../components/FilterBarConnected';
import { ResultsConnected } from '../../components/ResultsConnected';
import { Pager } from '../../components/Pager';
import styles from './search-page.module.css';

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Titled with the site name (the layout's); canonical: this language's address without the query string, which
 * it deliberately never reads; the page in the other languages as alternates.
 */
export function searchPageMetadata(locale: Locale): Metadata {
  return pageMetadata(makeT(locale), '/');
}

/**
 * The search page in `locale` (from the address: app/(zh-hant)/page.tsx, app/zh-hans/page.tsx, app/en/page.tsx):
 * destination picker, filter bar, count, cards and paging, all read from the address. The root layout supplies
 * the nav bar and footer. Rendered per request (requestDb), but the database results are reused (cachedReads):
 * a result shown is at most an hour old (see cached-reads.ts).
 */
export async function SearchPage({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = makeT(locale);
  const raw = await searchParams;
  const today = todayInHongKong();

  let data: SearchPageData;
  try {
    data = await loadSearchPage(await requestDb(), raw, today, t.locale, cachedReads);
  } catch (err) {
    unstable_rethrow(err); // Next.js's own signals (such as "render this per request") must pass through.
    // Missing DATABASE_URL or an unreachable database: the visitor gets a short message, the log gets the cause.
    console.error('search page: could not load tours:', err);
    return <p className={styles.error} role="alert">{t('search.error')}</p>;
  }

  const { state, tours, total, operators, filterOperators } = data;
  const destination = state.filters.destination ?? null;
  return (
    <>
      <div className={styles.searchRow}>
        {/* Both read the address with useSearchParams, which Next.js requires inside a Suspense boundary. */}
        <div className={styles.searchBox}>
          <Suspense fallback={null}><DestinationSearchConnected value={destination} /></Suspense>
        </div>
        <Suspense fallback={null}><DestinationPanelsConnected value={destination} /></Suspense>
      </div>
      <FilterBarConnected state={state} operators={filterOperators} today={today} />
      <ResultsConnected tours={tours} total={total} operators={operators} today={today} />
      <Pager state={state} total={total} t={t} />
    </>
  );
}
