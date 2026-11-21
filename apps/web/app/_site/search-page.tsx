import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteLink } from '../../components/SiteLink';
import { permanentRedirect } from 'next/navigation';
import { places, type Destination, type IsoDate } from '@hktours/core';
import { makeT, type Locale, type T } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import { pageMetadata } from '../../lib/site-metadata';
import { movedSearchHref } from '../../lib/search-params';
import type { SearchPageData } from '../../lib/search-page-data';
import { countOf, destinationName, destinationPath, isListed, topDestinations } from '../../lib/destinations';
import { formatCount, headlineCount } from '../../lib/format';
import { placeName } from '../../lib/place-names';
import { FilterBarConnected } from '../../components/FilterBarConnected';
import { ResultsConnected } from '../../components/ResultsConnected';
import { ListFooter, UpdatedNote } from '../../components/ListFooter';
import type { StateHref } from '../../components/Pager';
import { loadSearch, queryOf, type Loaded, type SearchParams } from './page-data';
import { SearchBand } from './search-band';
import frame from './site-frame.module.css';
import band from './search-band.module.css';
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
 * The search page's body, on '/' (destination null) and on a destination's page: the gold band (the heading with its
 * line of numbers, the destination search and the shortcuts), then the filter row, the tours and, under them, the
 * rows-per-page choice, the count and the pager. The root layout supplies the header and footer. Rendered per
 * request (requestDb), but the database results are reused (cachedReads): a result shown is at most an hour old (see
 * cached-reads.ts).
 *
 * The home page's heading counts the operators that list tours now and its line the tours (counts.all, from the
 * cached countToursByDestination read the page already makes: no extra statement); the shortcuts come from the same
 * counts.
 */
export function SearchView({ t, destination, load }: { t: T; destination: Destination | null; load: Loaded<SearchPageData> }) {
  const place = destination ? destinationName(destination, places, t) : null;
  if (!load.ok) {
    return (
      <>
        <SearchBand t={t} heading={place ? t('dest.heading', { place }) : t('home.heading')} />
        <SearchError t={t} />
      </>
    );
  }

  const { state, counts } = load.data;
  const { all } = counts;
  const listed = destination ? countOf(destination, counts) : all;
  const [heading, line] = place !== null
    ? [t('dest.heading', { place }), listed.tours > 0 ? t('dest.count', { tours: listed.tours, operators: listed.operators }) : t('dest.countNone')]
    : all.tours > 0
      ? [t('band.headline', { n: headlineCount(all.operators, t.locale), count: all.operators }), t('band.subline', { tours: formatCount(all.tours) })]
      : [t('home.heading'), t('dest.countNone')];
  return (
    <>
      <SearchBand
        t={t} heading={heading} line={line} state={state} shortcuts={topDestinations(places, counts)}
        related={destination && <Related t={t} destination={destination} data={load.data} />}
      />
      {/* On a destination's page, clearing every filter keeps the destination. */}
      <SearchList t={t} data={load.data} today={load.today} now={load.now} clearPath={destinationPath(destination)} />
    </>
  );
}

/** In place of the list when the tours could not be read: the visitor's message. */
export function SearchError({ t }: { t: T }) {
  return (
    <div className={`${frame.wrap} ${frame.page}`}>
      <p className={styles.error} role="alert">{t('search.error')}</p>
    </div>
  );
}

/**
 * Every search page's list, under its band (the search page, a destination's page, an operator's page): the filter
 * row, the tours, and under them the rows-per-page choice, the count, the pager and when the data was last updated.
 * `clearPath` is where the empty state's "clear all filters" goes; `hrefFor` how the choice of rows and the pager
 * build their addresses (the search page's, searchHref, by default; the filter row reads its page from
 * lib/search-address.tsx); `updatedFrom` the operators whose last update the note gives (all of them by default).
 */
export function SearchList({ t, data, today, now, clearPath, hrefFor, updatedFrom = data.operators }: {
  t: T; data: SearchPageData; today: IsoDate; now: string; clearPath: string; hrefFor?: StateHref;
  updatedFrom?: { lastGoodRunAt: string | null }[];
}) {
  const { state, tours, total, operators, filterOperators } = data;
  return (
    <div className={`${frame.wrap} ${frame.page}`}>
      <FilterBarConnected state={state} operators={filterOperators} today={today} />
      <ResultsConnected tours={tours} total={total} operators={operators} today={today} now={now} clearPath={clearPath} />
      <ListFooter state={state} total={total} t={t} hrefFor={hrefFor} />
      <UpdatedNote operators={updatedFrom} t={t} />
    </div>
  );
}

/**
 * Real links to the destinations next to this one that have pages of their own: a country's regions, or a region's
 * country. Nothing when there are none.
 */
function Related({ t, destination, data }: { t: T; destination: Destination; data: SearchPageData }) {
  const { counts } = data;
  const link = (d: Destination, text: string): ReactNode => (
    <SiteLink key={destinationPath(d)} className={band.relatedLink} href={localeHref(t.locale, destinationPath(d))}>{text}</SiteLink>
  );
  if (destination.regionId !== null) {
    const country: Destination = { countryId: destination.countryId, regionId: null };
    if (!isListed(country, places, counts)) return null;
    return <p className={band.related}>{link(country, t('dest.allOf', { country: destinationName(country, places, t) }))}</p>;
  }
  const regions = places.regionsOf(destination.countryId)
    .map(r => ({ countryId: r.countryId, regionId: r.id }))
    .filter(d => isListed(d, places, counts));
  if (regions.length === 0) return null;
  return (
    <p className={band.related}>
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
