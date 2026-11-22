import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { places, type Destination } from '@hktours/core';
import type { ListedCount } from '@hktours/db/read';
import { makeT, type Locale, type T } from '../../lib/i18n';
import { pageMetadata } from '../../lib/site-metadata';
import { TOURS_PATH, countOf, destinationFromId, destinationName, destinationPath, isListed } from '../../lib/destinations';
import { formatCount, formatPrice } from '../../lib/format';
import { breadcrumbJsonLd } from '../../lib/structured-data';
import { JsonLd } from '../../components/JsonLd';
import { loadSearch, queryOf, type SearchParams } from './page-data';
import { SearchView } from './search-page';

type Params = Promise<{ id: string }>;

/** The destination the path names; a real 404 (not-found.tsx in the page's language) for anything else. */
async function destinationOf(params: Params): Promise<Destination> {
  const destination = destinationFromId((await params).id, places);
  if (!destination) notFound();
  return destination;
}

/**
 * A destination's description, with its own facts before any filter (`count`: the canonical page's, from the counts
 * the page reads anyway): how many tours from how many operators, their shortest and longest length and their lowest
 * price; without the lengths and price when the counts do not carry them; the plain sentence when there are no tours
 * (or the tours could not be read: count null).
 */
export function destinationDescription(t: T, place: string, count: ListedCount | null): string {
  if (count === null || count.tours === 0) return t('dest.description', { place });
  const vars = { place, tours: formatCount(count.tours), operators: formatCount(count.operators) };
  const { range } = count;
  if (range === undefined) return t('dest.descriptionCounts', vars);
  const days = range.minDays === range.maxDays
    ? t('dest.daysOne', { days: range.minDays })
    : t('dest.daysRange', { min: range.minDays, max: range.maxDays });
  return t('dest.descriptionFacts', { ...vars, days, price: formatPrice(range.minPriceHkd) });
}

/**
 * Titled with the destination's name in the page's language ('日本旅行團比較') and described with its facts
 * (destinationDescription); canonical: this language's address of the destination without the query string; the
 * page in the other languages as alternates. Marked noindex when the destination has no page of its own for search engines (no tours now, an area region, the
 * only region of its country: lib/destinations.ts isListed) or when its tours could not be read.
 */
export async function destinationPageMetadata(locale: Locale, params: Params, searchParams: Promise<SearchParams>): Promise<Metadata> {
  const destination = await destinationOf(params);
  const t = makeT(locale);
  const place = destinationName(destination, places, t);
  const load = await loadSearch(locale, (await params).id, queryOf(await searchParams));
  return pageMetadata(t, destinationPath(destination), {
    title: t('dest.title', { place }),
    // The facts of the destination before any filter, whatever the address's filters: the canonical page's.
    description: destinationDescription(t, place, load.ok ? countOf(destination, load.data.counts) : null),
    noindex: !load.ok || !isListed(destination, places, load.data.counts),
  });
}

/**
 * A destination's page in `locale` (/tours/<id>: app/(zh-hant)/tours/[id]/page.tsx and the same in app/zh-hans and
 * app/en): the search page with the destination fixed by the path, under a heading naming it. Every other filter
 * stays in the query string on this same path (/tours/japan?dmin=5&sort=days). Its breadcrumb trail goes with it as
 * structured data (lib/structured-data.ts), whatever its tours.
 */
export async function DestinationPage({ locale, params, searchParams }: { locale: Locale; params: Params; searchParams: Promise<SearchParams> }) {
  const destination = await destinationOf(params);
  const t = makeT(locale);
  const load = await loadSearch(locale, (await params).id, queryOf(await searchParams));
  return (
    <>
      <SearchView t={t} destination={destination} load={load} />
      {/* Its place in the site: the destinations index, then this page under its heading. */}
      <JsonLd data={breadcrumbJsonLd(t, [
        { name: t('tours.title'), path: TOURS_PATH },
        { name: t('dest.heading', { place: destinationName(destination, places, t) }), path: destinationPath(destination) },
      ])} />
    </>
  );
}
