import type { Metadata } from 'next';
import { SiteLink } from '../../components/SiteLink';
import { makeT, type Locale } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import { pageMetadata } from '../../lib/site-metadata';
import { formatChipDate } from '../../lib/format';
import { chainPageHref } from '../../lib/chain-href';
import { loadChain, queryOf, type SearchParams } from './page-data';
import {
  ChainDestinationPanelsConnected, ChainDestinationSearchConnected, ChainFilterBarConnected, ChainResultsConnected, ChainStripConnected,
} from '../../components/ChainConnected';
import { ListFooter, UpdatedNote } from '../../components/ListFooter';
import frame from './site-frame.module.css';
import styles from './chain-page.module.css';

/**
 * Titled with the nav bar's name for this page (the layout's pattern adds the site name); canonical: this
 * language's address without the query string (the chain and filters); the page in the other languages as
 * alternates. Marked noindex when the tours could not be read (the page's own load, made once: see page-data.ts).
 */
export async function chainPageMetadata(locale: Locale, searchParams: Promise<SearchParams>): Promise<Metadata> {
  const t = makeT(locale);
  const load = await loadChain(locale, queryOf(await searchParams));
  return pageMetadata(t, '/chain', { title: t('nav.chain'), noindex: !load.ok });
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
  const load = await loadChain(locale, queryOf(await searchParams));
  // Missing DATABASE_URL or an unreachable database: the visitor gets a short message, the log gets the cause.
  if (!load.ok) return <div className={`${frame.wrap} ${frame.page}`}><p className={styles.error} role="alert">{t('search.error')}</p></div>;
  const { today, data } = load;

  const { address, legs, droppedCount, departWindow, next, full, operators, filterOperators } = data;
  const lastLeg = legs.at(-1);
  const date = (d: string) => formatChipDate(d, today, t);

  return (
    <div className={`${frame.wrap} ${frame.page}`}>
      {droppedCount > 0 && <p className={styles.notice} role="status">{t('chain.dropped')}</p>}

      {!lastLeg ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>{t('chain.empty')}</p>
          <SiteLink href={localeHref(t.locale, '/')} className={styles.link}>{t('nav.search')}</SiteLink>
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
                tours={next.tours} total={next.total} operators={operators} today={today} now={load.now}
              />
              <ListFooter
                state={address.search} total={next.total} t={t}
                hrefFor={search => chainPageHref({ chain: address.chain, search })}
              />
              <UpdatedNote operators={operators} t={t} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
