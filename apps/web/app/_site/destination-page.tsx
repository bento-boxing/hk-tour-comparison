import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { places, type Destination } from '@hktours/core';
import { makeT, type Locale } from '../../lib/i18n';
import { pageMetadata } from '../../lib/site-metadata';
import { destinationFromId, destinationName, destinationPath, isListed } from '../../lib/destinations';
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
 * Titled and described with the destination's name in the page's language ('日本旅行團比較'); canonical: this
 * language's address of the destination without the query string; the page in the other languages as alternates.
 * Marked noindex when the destination has no page of its own for search engines (no tours now, an area region, the
 * only region of its country: lib/destinations.ts isListed) or when its tours could not be read.
 */
export async function destinationPageMetadata(locale: Locale, params: Params, searchParams: Promise<SearchParams>): Promise<Metadata> {
  const destination = await destinationOf(params);
  const t = makeT(locale);
  const place = destinationName(destination, places, t);
  const load = await loadSearch(locale, (await params).id, queryOf(await searchParams));
  return pageMetadata(t, destinationPath(destination), {
    title: t('dest.title', { place }),
    description: t('dest.description', { place }),
    noindex: !load.ok || !isListed(destination, places, load.data.counts),
  });
}

/**
 * A destination's page in `locale` (/tours/<id>: app/(zh-hant)/tours/[id]/page.tsx and the same in app/zh-hans and
 * app/en): the search page with the destination fixed by the path, under a heading naming it. Every other filter
 * stays in the query string on this same path (/tours/japan?dmin=5&sort=days).
 */
export async function DestinationPage({ locale, params, searchParams }: { locale: Locale; params: Params; searchParams: Promise<SearchParams> }) {
  const destination = await destinationOf(params);
  const load = await loadSearch(locale, (await params).id, queryOf(await searchParams));
  return <SearchView t={makeT(locale)} destination={destination} load={load} />;
}
