import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { todayInHongKong } from '@hktours/core';
import { makeT, type Locale } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import { pageMetadata } from '../../lib/site-metadata';
import { requestDb } from '../../lib/db';
import { formatChipDate } from '../../lib/format';
import { chainPageHref, withPage } from '../../lib/chain-href';
import { loadChainPage, type ChainPageData } from '../../lib/chain-page-data';
import { cachedReads } from '../../lib/search-page-data';
import {
  ChainDestinationPanelsConnected, ChainDestinationSearchConnected, ChainFilterBarConnected, ChainResultsConnected, ChainStripConnected,
} from '../../components/ChainConnected';
import { Pager } from '../../components/Pager';
import styles from './chain-page.module.css';

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Titled with the nav bar's name for this page (the layout's pattern adds the site name); canonical: this
 * language's address without the query string (the chain and filters), which it deliberately never reads; the
 * page in the other languages as alternates.
 */
export function chainPageMetadata(locale: Locale): Metadata {
  const t = makeT(locale);
  return pageMetadata(t, '/chain', t('nav.chain'));
}

/**
 * The chaining page in `locale` (from the address: app/(zh-hant)/chain/page.tsx, app/zh-hans/chain/page.tsx,
 * app/en/chain/page.tsx): the chosen legs with their gaps and total, the gap selector, and the tours from any
 * operator that can follow, all read from the address (`legs`, `gap` and the search filters except dates).
 * The root layout supplies the nav bar and footer. Rendered per request (requestDb), but the database results
 * are reused (cachedReads): a result shown is at most an hour old (see cached-reads.ts).
 */
export async function ChainPage({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = makeT(locale);
  const raw = await searchParams;
  const today = todayInHongKong();

  let data: ChainPageData;
  try {
    data = await loadChainPage(await requestDb(), raw, today, t.locale, cachedReads);
  } catch (err) {
    unstable_rethrow(err); // Next.js's own signals (such as "render this per request") must pass through.
    // Missing DATABASE_URL or an unreachable database: the visitor gets a short message, the log gets the cause.
    console.error('chain page: could not load tours:', err);
    return <p className={styles.error} role="alert">{t('search.error')}</p>;
  }

  const { address, legs, droppedCount, departWindow, next, full, operators, filterOperators } = data;
  const lastLeg = legs.at(-1);
  const date = (d: string) => formatChipDate(d, today, t);

  return (
    <>
      {droppedCount > 0 && <p className={styles.notice} role="status">{t('chain.dropped')}</p>}

      {!lastLeg ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>{t('chain.empty')}</p>
          <Link href={localeHref(t.locale, '/')} className={styles.link}>{t('nav.search')}</Link>
        </div>
      ) : (
        <>
          <h2 className={styles.heading}>{t('chain.yours')}</h2>
          <ChainStripConnected address={address} legs={legs} departWindow={departWindow} operators={operators} today={today} />

          {full && <p className={styles.full}>{t('chain.full')}</p>}

          {departWindow && next && (
            <section aria-labelledby="next-heading">
              <h2 id="next-heading" className={styles.heading}>
                {t('chain.nextHeading', { from: date(departWindow.from), to: date(departWindow.to) })}
              </h2>
              <div className={styles.searchRow}>
                {/* The chain page's own pickers: they build the next address from the validated one, not the raw query. */}
                <div className={styles.searchBox}><ChainDestinationSearchConnected address={address} /></div>
                <ChainDestinationPanelsConnected address={address} />
              </div>
              <ChainFilterBarConnected address={address} operators={filterOperators} today={today} />
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
