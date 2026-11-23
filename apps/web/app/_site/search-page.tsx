import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { places, type Destination, type IsoDate } from '@hktours/core';
import { makeT, type Locale, type T } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import { pageMetadata, type PageMetadataOptions } from '../../lib/site-metadata';
import { movedSearchHref } from '../../lib/search-params';
import type { SearchPageData } from '../../lib/search-page-data';
import type { ListedCount } from '@hktours/db/read';
import { countOf, destinationName, destinationPath } from '../../lib/destinations';
import { bandDates, bandRows } from '../../lib/band-rows';
import { formatCount, headlineCount } from '../../lib/format';
import { FilterBarConnected } from '../../components/FilterBarConnected';
import { ResultsConnected } from '../../components/ResultsConnected';
import { ListFooter, UpdatedNote } from '../../components/ListFooter';
import type { StateHref } from '../../components/Pager';
import { loadSearch, loadStoredSearch, queryOf, type Loaded, type SearchParams, type SearchViewData } from './page-data';
import { SearchBand } from './search-band';
import { JsonLd } from '../../components/JsonLd';
import { websiteJsonLd } from '../../lib/structured-data';
import { sheetSeasons } from '../../lib/filter-sheet';
import type { SeasonCount } from '../../lib/season-counts';
import frame from './site-frame.module.css';
import styles from './search-page.module.css';

/**
 * The home page's own title and description, with the counts from its data (the operators listing tours now and the
 * tours listed now: counts.all, as the band's headline): the searched words first and the site name last.
 */
export function homeMetadata(t: T, all: ListedCount): PageMetadataOptions {
  const counts = { operators: formatCount(all.operators), tours: formatCount(all.tours) };
  return { fullTitle: t('home.title', { ...counts, site: t('site.name') }), description: t('home.description', counts) };
}

/**
 * Titled and described with the counts (homeMetadata); canonical: this language's address without the query string;
 * the page in the other languages as alternates. Marked noindex when the tours could not be read, so an outage is
 * never indexed as the page (the load is the page's own, made once: see page-data.ts); it is then titled with the
 * site name alone (the layout's), as when no tour is listed.
 */
export async function searchPageMetadata(locale: Locale, searchParams: Promise<SearchParams>): Promise<Metadata> {
  const t = makeT(locale);
  const raw = await searchParams;
  // An old address the page moves elsewhere: nothing to read.
  if (movedSearchHref(raw, places) !== null) return pageMetadata(t, '/');
  const load = await loadSearch(locale, null, queryOf(raw));
  if (!load.ok) return pageMetadata(t, '/', { noindex: true });
  const { all } = load.data.counts;
  return pageMetadata(t, '/', all.tours > 0 ? homeMetadata(t, all) : {});
}

/**
 * The search page in `locale` with a query string, rendered per request (from the address: the per-request copies
 * app/(zh-hant)/q/page.tsx, app/zh-hans/q/page.tsx, app/en/q/page.tsx, which next.config.ts answers '/?dmin=5' with;
 * lib/search-rewrites.ts). The address without a filter is the stored copy, StoredSearchPage below.
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
 * The stored copy's metadata (the home page without a query string: app/(zh-hant)/page.tsx and the other two
 * languages'): the same as searchPageMetadata gives the bare address with the tours read. Its counts come from the
 * stored copy's own load (loadStoredSearch: React's cache hands the page the same one, so the data is read once),
 * which reads nothing from the request. A stored copy is only made with its data (the load throws otherwise), so it
 * is never noindex.
 */
export async function storedSearchPageMetadata(locale: Locale): Promise<Metadata> {
  const t = makeT(locale);
  const load = await loadStoredSearch(locale);
  return pageMetadata(t, '/', homeMetadata(t, load.data.counts.all));
}

/**
 * The home page in `locale` without a query string, as a stored copy: made at build time, then again at most once an
 * hour. It reads nothing from the request. Its filtered addresses are answered by the per-request copy (SearchPage, at
 * the internal address '/q': lib/search-rewrites.ts), with the same body.
 */
export async function StoredSearchPage({ locale }: { locale: Locale }) {
  return <SearchView t={makeT(locale)} destination={null} load={await loadStoredSearch(locale)} />;
}

/**
 * The search page's body, on '/' (destination null) and on a destination's page: the gold band (the heading with its
 * line of numbers, the destination search and the shortcuts), then the filter row, the tours and, under them, the
 * rows-per-page choice, the count and the pager. The root layout supplies the header and footer. Rendered per
 * request (requestDb), except the home page without a filter, which is a stored copy (StoredSearchPage); either way
 * the database results are reused (cachedReads): a result shown is at most an hour old, plus the stored copy's age
 * (see cached-reads.ts).
 *
 * The home page's heading counts the operators that list tours now and its line the tours (counts.all, from the
 * cached countToursByDestination read the page already makes: no extra statement). Under them, the band's two rows of
 * boxes (lib/band-rows.ts: the destinations, or the page's destination with its regions; the seasons), from the same
 * counts and the load's season counts. Under the heading, the home page only says in one line what the site does (band.lede), and gives search
 * engines the site's WebSite block (lib/structured-data.ts).
 */
export function SearchView({ t, destination, load }: { t: T; destination: Destination | null; load: Loaded<SearchViewData> }) {
  const place = destination ? destinationName(destination, places, t) : null;
  // The home page says what the site does in the words people search, whatever its data.
  const lede = place === null ? t('band.lede') : undefined;
  // … and, to search engines, what the site is (its name and address in this language): on the home page only.
  const site = place === null ? <JsonLd data={websiteJsonLd(t)} /> : null;
  if (!load.ok) {
    return (
      <>
        {site}
        <SearchBand t={t} heading={place ? t('dest.heading', { place }) : t('home.heading')} lede={lede} />
        <SearchError t={t} />
      </>
    );
  }

  const { state, counts } = load.data;
  const { all } = counts;
  const listed = destination ? countOf(destination, counts) : all;
  const rows = bandRows(t, state, counts, load.data.seasons);
  const [heading, line] = place !== null
    ? [t('dest.heading', { place }), listed.tours > 0 ? t('dest.count', { tours: formatCount(listed.tours), operators: formatCount(listed.operators) }) : t('dest.countNone')]
    : all.tours > 0
      ? [t('band.headline', { n: headlineCount(all.operators, t.locale), count: all.operators }), t('band.subline', { tours: formatCount(all.tours) })]
      : [t('home.heading'), t('dest.countNone')];
  return (
    <>
      {site}
      <SearchBand
        t={t} heading={heading} line={line} lede={lede} state={state} rows={rows}
        dates={bandDates(t, state, rows, load.data.seasons, load.data.months, load.today)}
      />
      {/* On a destination's page, clearing every filter keeps the destination. */}
      <SearchList t={t} data={load.data} today={load.today} now={load.now} clearPath={destinationPath(destination)} seasons={load.data.seasons} dateField />
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
 * lib/search-address.tsx); `updatedFrom` the operators whose last update the note gives (all of them by default);
 * `seasons` the seasons' counts the page has read (for the band), whose seasons with tours the phone filter sheet
 * offers as one-tap dates (none where the page has not read them: an operator's page).
 */
export function SearchList({ t, data, today, now, clearPath, hrefFor, updatedFrom = data.operators, seasons = [], dateField = false }: {
  t: T; data: SearchPageData; today: IsoDate; now: string; clearPath: string; hrefFor?: StateHref;
  updatedFrom?: { lastGoodRunAt: string | null }[]; seasons?: SeasonCount[];
  /** The band above has the phone's date field (task 78): the phone filter sheet leaves the dates to it. */
  dateField?: boolean;
}) {
  const { state, tours, total, operators, filterOperators } = data;
  return (
    <div className={`${frame.wrap} ${frame.page}`}>
      <FilterBarConnected state={state} operators={filterOperators} today={today} total={total} seasons={sheetSeasons(state, seasons)} dateField={dateField} />
      <ResultsConnected tours={tours} total={total} operators={operators} today={today} now={now} clearPath={clearPath} />
      <ListFooter state={state} total={total} t={t} hrefFor={hrefFor} />
      <UpdatedNote operators={updatedFrom} t={t} />
    </div>
  );
}
