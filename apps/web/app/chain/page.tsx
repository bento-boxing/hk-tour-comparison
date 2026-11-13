import { Suspense } from 'react';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { todayInHongKong } from '@hktours/core';
import { getT } from '../../lib/i18n';
import { requestDb } from '../../lib/db';
import { formatChipDate } from '../../lib/format';
import { chainPageHref, withPage } from '../../lib/chain-href';
import { loadChainPage, type ChainPageData } from '../../lib/chain-page-data';
import { DestinationPanelsConnected, DestinationSearchConnected } from '../../components/DestinationConnected';
import { ChainFilterBarConnected, ChainResultsConnected, ChainStripConnected } from '../../components/ChainConnected';
import { Pager } from '../../components/Pager';
import styles from './page.module.css';

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The chaining page: the chosen legs with their gaps and total, the gap selector, and the tours from any
 * operator that can follow, all read from the address (`legs`, `gap` and the search filters except dates).
 * The root layout supplies the nav bar and footer. Rendered per request (requestDb), so it shows the latest scrape.
 */
export default async function ChainPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const t = getT();
  const raw = await searchParams;
  const today = todayInHongKong();

  let data: ChainPageData;
  try {
    data = await loadChainPage(await requestDb(), raw, today);
  } catch (err) {
    unstable_rethrow(err); // Next.js's own signals (such as "render this per request") must pass through.
    // Missing DATABASE_URL or an unreachable database: the visitor gets a short message, the log gets the cause.
    console.error('chain page: could not load tours:', err);
    return <p className={styles.error} role="alert">{t('search.error')}</p>;
  }

  const { address, legs, droppedCount, window, next, full, operators } = data;
  const lastLeg = legs.at(-1);
  const date = (d: string) => formatChipDate(d, today);

  return (
    <>
      {droppedCount > 0 && <p className={styles.notice} role="status">{t('chain.dropped')}</p>}

      {!lastLeg ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>{t('chain.empty')}</p>
          <Link href="/" className={styles.link}>{t('nav.search')}</Link>
        </div>
      ) : (
        <>
          <h2 className={styles.heading}>{t('chain.yours')}</h2>
          <ChainStripConnected address={address} legs={legs} window={window} operators={operators} today={today} />

          {full && <p className={styles.full}>{t('chain.full')}</p>}

          {window && next && (
            <section aria-labelledby="next-heading">
              <h2 id="next-heading" className={styles.heading}>
                {t('chain.nextHeading', { from: date(window.from), to: date(window.to) })}
              </h2>
              <div className={styles.searchRow}>
                {/* Both read the address with useSearchParams, which Next.js requires inside a Suspense boundary. */}
                <div className={styles.searchBox}>
                  <Suspense fallback={null}><DestinationSearchConnected value={address.search.filters.destination ?? null} /></Suspense>
                </div>
                <Suspense fallback={null}><DestinationPanelsConnected value={address.search.filters.destination ?? null} /></Suspense>
              </div>
              <ChainFilterBarConnected address={address} operators={operators} today={today} />
              <ChainResultsConnected
                address={address} lastEndDate={lastLeg.endDate}
                tours={next.tours} total={next.total} operators={operators} today={today}
              />
              <Pager state={address.search} total={next.total} t={t} hrefFor={page => chainPageHref(withPage(address, page))} />
            </section>
          )}
        </>
      )}
    </>
  );
}
