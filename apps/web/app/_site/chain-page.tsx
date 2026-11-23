import type { Metadata } from 'next';
import { SiteLink } from '../../components/SiteLink';
import { makeT, type Locale, type T } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import { pageMetadata } from '../../lib/site-metadata';
import { formatChipDate } from '../../lib/format';
import { places, type Destination } from '@hktours/core';
import { bandDates, bandRows } from '../../lib/band-rows';
import { chainPageHref, withDestination, type ChainAddress } from '../../lib/chain-href';
import { placeName } from '../../lib/place-names';
import { PhoneChips, type PhoneChip } from './search-band';
import { loadChain, queryOf, type SearchParams } from './page-data';
import {
  ChainDateFieldConnected, ChainDestinationPanelsConnected, ChainDestinationScreenConnected, ChainDestinationSearchConnected, ChainFilterBarConnected, ChainResultsConnected, ChainStripConnected,
} from '../../components/ChainConnected';
import { TripClear, TripMemory, TripPickHead, TripSteps } from '../../components/TripPhone';
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
 *
 * On a phone (under 1024px; task 71) the same page is two screens, by the address: the trip alone, as numbered steps
 * (TripSteps), or, with `pick=1`, the screen for choosing the next (or first) tour: its bar and the trip's total
 * (TripPickHead) over this page's search box, filters and tours. CSS shows the one the address names (`data-view`);
 * from 1024px the page is as it was, whatever the address says of the screen.
 */
export async function ChainPage({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = makeT(locale);
  const load = await loadChain(locale, queryOf(await searchParams));
  // Missing DATABASE_URL or an unreachable database: the visitor gets a short message, the log gets the cause.
  if (!load.ok) return <div className={`${frame.wrap} ${frame.page}`}><p className={styles.error} role="alert">{t('search.error')}</p></div>;
  const { today, data } = load;

  const { address, legs, droppedCount, departWindow, next, full, operators, filterOperators, bare, requested } = data;
  const lastLeg = legs.at(-1);
  const date = (d: string) => formatChipDate(d, today, t);
  const pick = address.pick === true;
  // Choosing the first tour on a phone: the 幾時出發？ field's choices, as the search page's band makes them (task 78).
  const ft = data.firstTour;
  const dates = ft ? bandDates(t, address.search, bandRows(t, address.search, ft.counts, ft.seasons), ft.seasons, ft.months, today) : null;

  return (
    <div className={`${frame.wrap} ${frame.page} ${styles.view}`} data-view={pick ? 'pick' : 'trip'}>
      <TripMemory chain={address.chain} requested={requested} bare={bare} />
      {pick && <TripPickHead address={address} legs={legs} departWindow={departWindow} today={today} />}

      {droppedCount > 0 && <p className={styles.notice} role="status">{t('chain.dropped')}</p>}

      {/* The trip: from 1024px the heading and strip (or the empty message); on a phone the heading, 清空 and the steps. */}
      {!pick && (
        <div className={styles.tripArea}>
          {lastLeg ? (
            <>
              <div className={styles.yoursRow}>
                <h2 className={styles.heading}>{t('chain.yours')}</h2>
                <TripClear address={address} />
              </div>
              <div className={styles.wideOnly}>
                <ChainStripConnected address={address} legs={legs} departWindow={departWindow} operators={operators} today={today} />
              </div>
            </>
          ) : (
            <>
              <div className={`${styles.yoursRow} ${styles.phoneOnly}`}>
                <h2 className={styles.heading}>{t('chain.yours')}</h2>
              </div>
              <div className={`${styles.empty} ${styles.wideOnly}`}>
                <p className={styles.emptyText}>{t('chain.empty')}</p>
                <SiteLink href={localeHref(t.locale, '/')} className={styles.link}>{t('nav.search')}</SiteLink>
              </div>
            </>
          )}
          <TripSteps address={address} requested={requested} legs={legs} departWindow={departWindow} operators={operators} today={today} />
        </div>
      )}
      {/* The choosing screen's address, opened at 1024px or wider, is the trip page as it always was. */}
      {pick && lastLeg && (
        <div className={styles.wideOnly}>
          <h2 className={styles.heading}>{t('chain.yours')}</h2>
          <ChainStripConnected address={address} legs={legs} departWindow={departWindow} operators={operators} today={today} />
        </div>
      )}
      {pick && !lastLeg && (
        <div className={`${styles.empty} ${styles.wideOnly}`}>
          <p className={styles.emptyText}>{t('chain.empty')}</p>
          <SiteLink href={localeHref(t.locale, '/')} className={styles.link}>{t('nav.search')}</SiteLink>
        </div>
      )}

      {full && <p className={styles.full}>{t('chain.full')}</p>}

      {next && (
        // On a phone, part of the choosing screen only. Without a window (the first tour of an empty trip), there is
        // no such list from 1024px.
        <section
          aria-labelledby={departWindow ? 'next-heading' : 'pick-heading'}
          className={departWindow ? styles.next : `${styles.next} ${styles.phoneOnly}`}
        >
          {departWindow && (
            <h2 id="next-heading" className={`${styles.heading} ${styles.nextHeading}`}>
              {t('chain.nextHeading', { from: date(departWindow.from), to: date(departWindow.to) })}
            </h2>
          )}
          <div className={`${styles.searchRow} ${styles.wideOnly}`}>
            {/* The chain page's own pickers: they build the next address from the validated one, not the raw query. */}
            <div className={styles.searchBox}><ChainDestinationSearchConnected address={address} /></div>
            <ChainDestinationPanelsConnected address={address} />
          </div>
          {/*
            On a phone, the home band's controls (tasks 73, 77, 78): the search box that opens the full-screen search, in
            place of both; the chosen country and region as chips; for the first tour, the 幾時出發？ field.
          */}
          <div className={`${styles.phoneSearch} ${styles.phoneOnly}`}>
            <ChainDestinationScreenConnected address={address} screen={data.screen} />
            <PhoneChips t={t} chips={chainChips(t, address)} />
            {dates && ft && (
              <ChainDateFieldConnected
                address={address}
                choices={{
                  value: dates.value, months: dates.months, travel: false,
                  // No counts here, as the popular boxes (the next tour is chosen with the trip's other filters); a
                  // festival with no tours at all, site-wide, stays faded.
                  festivals: dates.festivals.map(f => ({
                    ...f, tours: null, enabled: (ft.seasons.find(s => s.window.season === f.key)?.count.tours ?? 0) > 0,
                  })),
                }}
              />
            )}
          </div>
          <ChainFilterBarConnected
            address={address} operators={filterOperators} today={today} dateField={dates !== null}
            // Its phone sheet's departure dates (task 75): the first tour's, as on the search page; a later one's, set by the trip.
            sheetDates={departWindow
              ? { note: `${t('trip.window', { from: date(departWindow.from), to: date(departWindow.to) })} · ${t('filter.setByTrip')}` }
              : 'edit'}
          />
          <ChainResultsConnected
            address={address} lastEndDate={lastLeg?.endDate}
            tours={next.tours} total={next.total} operators={operators} today={today} now={load.now}
          />
          <ListFooter
            state={address.search} total={next.total} t={t}
            hrefFor={search => chainPageHref({ ...address, search })}
          />
          <UpdatedNote operators={operators} t={t} />
        </section>
      )}
    </div>
  );
}

/**
 * The choosing screen's chips on a phone (task 78, as the band's: task 77): the chosen country, ✕ to no destination,
 * then a chosen region by its own name, ✕ to its country; the trip, the screen and every other filter kept.
 */
function chainChips(t: T, address: ChainAddress): PhoneChip[] {
  const dest = address.search.filters.destination;
  if (!dest) return [];
  const country = places.country(dest.countryId);
  const chip = (key: string, name: string, to: Destination | null): PhoneChip => ({
    key, name, path: chainPageHref(withDestination(address, to)), label: t('band.selectedName', { name }),
  });
  const chips = [chip(dest.countryId, country ? placeName(country, t.locale) : dest.countryId, null)];
  if (dest.regionId !== null) {
    const region = places.region(dest.regionId);
    chips.push(chip(dest.regionId, region ? placeName(region, t.locale) : dest.regionId, { countryId: dest.countryId, regionId: null }));
  }
  return chips;
}
