import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ListedCount } from '@hktours/db/read';
import { makeT, type Locale, type T } from '../../lib/i18n';
import { pageMetadata } from '../../lib/site-metadata';
import { TOURS_PATH } from '../../lib/destinations';
import { formatCount, formatDayRange, formatPrice } from '../../lib/format';
import { SEASON_NAME_KEYS, seasonFromId, seasonPath, seasonSearchHref, type SeasonWindow } from '../../lib/seasons';
import { breadcrumbJsonLd } from '../../lib/structured-data';
import { FixedSeasonProvider } from '../../lib/search-address';
import { JsonLd } from '../../components/JsonLd';
import { loadSeason, queryOf, type SeasonLoad, type SearchParams } from './page-data';
import { SearchBand } from './search-band';
import { SearchError, SearchList } from './search-page';

type Params = Promise<{ id: string }>;

/** A season's page's heading, in `t`'s language: '2026 聖誕旅行團', 'Christmas 2026 group tours'. */
export function seasonHeading(t: T, window: SeasonWindow): string {
  return t('season.heading', { season: t(SEASON_NAME_KEYS[window.season].name), year: window.year });
}

/** The season's days, as the page says them: '12月19日至27日', '19 to 27 Dec'. */
export function seasonDates(t: T, window: SeasonWindow): string {
  return formatDayRange(window.from, window.to, t);
}

/**
 * The season's page's description, from the season's own facts before any filter (the canonical page's): its year
 * and days, how many tours from how many operators, and the lowest price; with no tours (or none known), the same
 * opening and where to book, with no numbers.
 */
export function seasonDescription(t: T, window: SeasonWindow, count: ListedCount | null): string {
  const vars = { season: t(SEASON_NAME_KEYS[window.season].description), year: window.year, dates: seasonDates(t, window) };
  if (count === null || count.tours === 0 || count.range === undefined) return t('season.descriptionNone', vars);
  return t('season.description', {
    ...vars, tours: formatCount(count.tours), operators: formatCount(count.operators), price: formatPrice(count.range.minPriceHkd),
  });
}

/**
 * The season the path names and its load; a real 404 (not-found.tsx in the page's language) for any other id, before
 * any read, and for a season without a current window (past the Lunar New Year table's end: lib/seasons.ts).
 */
async function seasonLoad(locale: Locale, params: Params, searchParams: Promise<SearchParams>): Promise<SeasonLoad> {
  const season = seasonFromId((await params).id);
  if (!season) notFound();
  const result = await loadSeason(locale, season, queryOf(await searchParams));
  if (!result) notFound();
  return result;
}

/**
 * Titled with the season and its year ('聖誕旅行團 2026 比較'), described with its facts (seasonDescription);
 * canonical: this language's address of the season's page without the query string (as a destination's page); the
 * page in the other languages as alternates. Marked noindex when the season has no tours now (then it is not in the
 * sitemap either) or when they could not be read.
 */
export async function seasonPageMetadata(locale: Locale, params: Params, searchParams: Promise<SearchParams>): Promise<Metadata> {
  const { window, load } = await seasonLoad(locale, params, searchParams);
  const t = makeT(locale);
  return pageMetadata(t, seasonPath(window.season), {
    title: t('season.title', { season: t(SEASON_NAME_KEYS[window.season].name), year: window.year }),
    description: seasonDescription(t, window, load.ok ? load.data.count : null),
    noindex: !load.ok || load.data.count.tours === 0,
  });
}

/**
 * A season's page in `locale` (/seasons/<id>: app/(zh-hant)/seasons/[id]/page.tsx and the same in app/zh-hans and
 * app/en): the search page with the departure window fixed to the season's days (its current window: next year's once
 * this year's have passed), under a heading naming the season and its year, and a line with its days and its count.
 * Every other filter stays in the query string on this same path (/seasons/christmas?dest=japan&dmin=5); the departure
 * dates show the season's days as chosen, and changing them goes to the search page with the new dates
 * (lib/seasons.ts seasonSearchHref). No destination shortcuts: they lead away from the season. A season with no tours
 * gets the usual "no tours" state. Its breadcrumb trail goes with it as structured data, whatever its tours.
 */
export async function SeasonPage({ locale, params, searchParams }: { locale: Locale; params: Params; searchParams: Promise<SearchParams> }) {
  const { window, load } = await seasonLoad(locale, params, searchParams);
  const t = makeT(locale);
  const heading = seasonHeading(t, window);
  const path = seasonPath(window.season);
  const trail = <JsonLd data={breadcrumbJsonLd(t, [{ name: t('tours.title'), path: TOURS_PATH }, { name: heading, path }])} />;
  if (!load.ok) {
    return (
      <>
        {trail}
        <SearchBand t={t} heading={heading} />
        <SearchError t={t} />
      </>
    );
  }
  const { search, count } = load.data;
  const dates = seasonDates(t, window);
  const line = count.tours > 0
    ? t('season.count', { dates, tours: formatCount(count.tours), operators: formatCount(count.operators) })
    : t('season.countNone', { dates });
  return (
    // The band's destination search and the filter row record their choices on this page (lib/search-address.tsx).
    <FixedSeasonProvider season={window}>
      {trail}
      <SearchBand t={t} heading={heading} line={line} state={search.state} />
      <SearchList
        t={t} data={search} today={load.today} now={load.now} clearPath={path}
        hrefFor={state => seasonSearchHref(window, state)}
      />
    </FixedSeasonProvider>
  );
}
