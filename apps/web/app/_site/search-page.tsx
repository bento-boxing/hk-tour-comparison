import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { permanentRedirect } from 'next/navigation';
import { places, type Destination } from '@hktours/core';
import { makeT, type Locale, type T } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import { pageMetadata } from '../../lib/site-metadata';
import { movedSearchHref } from '../../lib/search-params';
import type { SearchPageData } from '../../lib/search-page-data';
import { TOURS_PATH, countOf, destinationName, destinationPath, isListed } from '../../lib/destinations';
import { placeName } from '../../lib/place-names';
import { DestinationPanelsConnected, DestinationSearchConnected } from '../../components/DestinationConnected';
import { FilterBarConnected } from '../../components/FilterBarConnected';
import { ResultsConnected } from '../../components/ResultsConnected';
import { Pager } from '../../components/Pager';
import { loadSearch, queryOf, type Loaded, type SearchParams } from './page-data';
import styles from './search-page.module.css';

/**
 * Titled with the site name (the layout's); canonical: this language's address without the query string; the page
 * in the other languages as alternates. Marked noindex when the tours could not be read, so an outage is never
 * indexed as the page (the load is the page's own, made once: see page-data.ts).
 */
export async function searchPageMetadata(locale: Locale, searchParams: Promise<SearchParams>): Promise<Metadata> {
  const t = makeT(locale);
  const raw = await searchParams;
  // An old address the page moves elsewhere: nothing to read.
  if (movedSearchHref(raw, places) !== null) return pageMetadata(t, '/');
  const load = await loadSearch(locale, null, queryOf(raw));
  return pageMetadata(t, '/', { noindex: !load.ok });
}

/**
 * The search page in `locale` (from the address: app/(zh-hant)/page.tsx, app/zh-hans/page.tsx, app/en/page.tsx).
 * A destination is no longer part of its query: an old address that names one (/?dest=japan&dmin=5) is moved
 * permanently (308) to the destination's page with the other filters (/tours/japan?dmin=5), before anything is
 * read; one whose dest names nothing stays, and its dest is ignored.
 */
export async function SearchPage({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = makeT(locale);
  const raw = await searchParams;
  const moved = movedSearchHref(raw, places);
  if (moved !== null) permanentRedirect(localeHref(t.locale, moved));
  return <SearchView t={t} destination={null} load={await loadSearch(locale, null, queryOf(raw))} />;
}

/**
 * The search page's body, on '/' (destination null) and on a destination's page: the heading and its line of
 * counts, the destination picker, filter bar, count, cards and paging. The root layout supplies the nav bar and
 * footer. Rendered per request (requestDb), but the database results are reused (cachedReads): a result shown is at
 * most an hour old (see cached-reads.ts).
 */
export function SearchView({ t, destination, load }: { t: T; destination: Destination | null; load: Loaded<SearchPageData> }) {
  const heading = destination ? t('dest.heading', { place: destinationName(destination, places, t) }) : t('home.heading');
  if (!load.ok) {
    return (
      <>
        <h1 className={styles.heading}>{heading}</h1>
        <p className={styles.error} role="alert">{t('search.error')}</p>
      </>
    );
  }

  const { state, tours, total, operators, filterOperators, counts } = load.data;
  const listed = destination ? countOf(destination, counts) : counts.all;
  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.heading}>{heading}</h1>
        <p className={styles.summary}>
          {listed.tours > 0 ? t('dest.count', { tours: listed.tours, operators: listed.operators }) : t('dest.countNone')}
          {destination === null && (
            <> <Link className={styles.link} href={localeHref(t.locale, TOURS_PATH)}>{t('home.browse')}</Link></>
          )}
        </p>
        {destination && <Related t={t} destination={destination} data={load.data} />}
      </div>
      <div className={styles.searchRow}>
        <div className={styles.searchBox}><DestinationSearchConnected state={state} /></div>
        <DestinationPanelsConnected state={state} />
      </div>
      <FilterBarConnected state={state} operators={filterOperators} today={load.today} />
      {/* On a destination's page, clearing every filter keeps the destination. */}
      <ResultsConnected tours={tours} total={total} operators={operators} today={load.today} clearPath={destinationPath(destination)} />
      <Pager state={state} total={total} t={t} />
    </>
  );
}

/**
 * Real links to the destinations next to this one that have pages of their own: a country's regions, or a region's
 * country. Nothing when there are none.
 */
function Related({ t, destination, data }: { t: T; destination: Destination; data: SearchPageData }) {
  const { counts } = data;
  const link = (d: Destination, text: string): ReactNode => (
    <Link key={destinationPath(d)} className={styles.link} href={localeHref(t.locale, destinationPath(d))}>{text}</Link>
  );
  if (destination.regionId !== null) {
    const country: Destination = { countryId: destination.countryId, regionId: null };
    if (!isListed(country, places, counts)) return null;
    return <p className={styles.related}>{link(country, t('dest.allOf', { country: destinationName(country, places, t) }))}</p>;
  }
  const regions = places.regionsOf(destination.countryId)
    .map(r => ({ countryId: r.countryId, regionId: r.id }))
    .filter(d => isListed(d, places, counts));
  if (regions.length === 0) return null;
  return (
    <p className={styles.related}>
      {t('dest.regions')}
      {regions.map((d, i) => [
        i > 0 && <span key={`sep-${i}`} aria-hidden="true"> · </span>,
        link(d, regionName(d, t)),
      ])}
    </p>
  );
}

/** A region's own name, without its country (the page already names it). */
function regionName(destination: Destination, t: T): string {
  const region = destination.regionId === null ? undefined : places.region(destination.regionId);
  return region ? placeName(region, t.locale) : destinationName(destination, places, t);
}
