import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { todayInHongKong } from '@hktours/core';
import { getT } from '../lib/i18n';
import { requestDb } from '../lib/db';
import { loadSearchPage, type SearchPageData } from '../lib/search-page-data';
import { DestinationPanelsConnected, DestinationSearchConnected } from '../components/DestinationConnected';
import { FilterBarConnected } from '../components/FilterBarConnected';
import { ResultsConnected } from '../components/ResultsConnected';
import { Pager } from '../components/Pager';
import styles from './page.module.css';

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The search page: destination picker, filter bar, count, cards and paging, all read from the address.
 * The root layout supplies the nav bar and footer. Rendered per request (requestDb), so it shows the latest scrape.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const t = getT();
  const raw = await searchParams;
  const today = todayInHongKong();

  let data: SearchPageData;
  try {
    data = await loadSearchPage(await requestDb(), raw, today);
  } catch (err) {
    unstable_rethrow(err); // Next.js's own signals (such as "render this per request") must pass through.
    // Missing DATABASE_URL or an unreachable database: the visitor gets a short message, the log gets the cause.
    console.error('search page: could not load tours:', err);
    return <p className={styles.error} role="alert">{t('search.error')}</p>;
  }

  const { state, tours, total, operators } = data;
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
      <FilterBarConnected state={state} operators={operators} today={today} />
      <ResultsConnected tours={tours} total={total} operators={operators} today={today} />
      <Pager state={state} total={total} t={t} />
    </>
  );
}
