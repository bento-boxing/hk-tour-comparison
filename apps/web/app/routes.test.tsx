import { it, expect, vi } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { ReactElement } from 'react';
import { places } from '@hktours/core';
import type { DestinationCounts, OperatorListing } from '@hktours/db/read';
import { LOCALES, type Locale } from '../lib/i18n';
import { LOCALE_SEGMENT, localeHref, siteUrl } from '../lib/locale-path';
import { destinationPath, listedDestinations } from '../lib/destinations';
import { isOperatorListed, operatorPath } from '../lib/operators';

// The route files are thin: each passes its language (and its params and query) to the shared page, layout or
// metadata, which are stood in for here.
vi.mock('./_site/search-page', () => ({
  SearchPage: () => null,
  searchPageMetadata: (locale: Locale, searchParams: unknown) => ({ page: 'search', locale, searchParams }),
}));
vi.mock('./_site/chain-page', () => ({
  ChainPage: () => null,
  chainPageMetadata: (locale: Locale, searchParams: unknown) => ({ page: 'chain', locale, searchParams }),
}));
vi.mock('./_site/destination-page', () => ({
  DestinationPage: () => null,
  destinationPageMetadata: (locale: Locale, params: unknown, searchParams: unknown) => ({ page: 'destination', locale, params, searchParams }),
}));
vi.mock('./_site/tours-page', () => ({
  ToursPage: () => null,
  toursPageMetadata: (locale: Locale) => ({ page: 'tours', locale }),
}));
vi.mock('./_site/operators-page', () => ({
  OperatorsPage: () => null,
  operatorsPageMetadata: (locale: Locale) => ({ page: 'operators', locale }),
}));
vi.mock('./_site/operator-page', () => ({
  OperatorPage: () => null,
  operatorPageMetadata: (locale: Locale, params: unknown, searchParams: unknown) => ({ page: 'operator', locale, params, searchParams }),
}));
vi.mock('./_site/about-page', () => ({
  AboutPage: () => null,
  aboutPageMetadata: (locale: Locale) => ({ page: 'about', locale }),
}));
vi.mock('./_site/saved-page', () => ({
  SavedPage: () => null,
  savedPageMetadata: (locale: Locale) => ({ page: 'saved', locale }),
}));
vi.mock('./_site/not-found-page', () => ({
  NotFoundPage: () => null,
  notFoundMetadata: (locale: Locale) => ({ page: 'not-found', locale }),
}));
vi.mock('./_site/site-frame', () => ({
  SiteFrame: () => null,
  siteFrameMetadata: (locale: Locale) => ({ frame: true, locale }),
}));

// The sitemap reads which destinations have tours: invented counts, through stand-ins for the database and its cache.
const counts: DestinationCounts = {
  all: { tours: 3, operators: 2 },
  destinations: [
    { countryId: 'japan', regionId: null, tours: 3, operators: 2 },
    { countryId: 'japan', regionId: 'japan-kansai', tours: 2, operators: 1 },
    { countryId: 'korea', regionId: null, tours: 1, operators: 1 },
  ],
};
const listing = (id: OperatorListing['id'], tours: number): OperatorListing => ({
  id, nameZh: id, nameEn: id, color: '#000000', siteUrl: 'https://example.test', lastGoodRunAt: '2026-11-12T18:00:00.000Z', tours, countries: [],
});
const operators = [listing('egl', 2), listing('jetour', 0), listing('texpert', 1)];
vi.mock('../lib/db', () => ({ requestDb: async () => ({}) }));
vi.mock('../lib/search-page-data', () => ({
  cachedReads: { countToursByDestination: async () => counts, getOperatorListings: async () => operators },
}));
const { default: sitemap } = await import('./sitemap');

/** The folder under app/ that holds each language's pages: a route group for the unprefixed Traditional Chinese. */
const ROOT: Record<Locale, string> = { 'zh-Hant': '(zh-hant)', 'zh-Hans': 'zh-hans', en: 'en' };

/** Every page path in a language's folder ('/', '/chain', '/tours/[id]'), from its page.tsx files. */
function pagePaths(locale: Locale): string[] {
  const root = join(__dirname, ROOT[locale]);
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else if (entry.name === 'page.tsx') found.push(`/${relative(root, dir).split(sep).join('/')}`.replace(/\/$/, '') || '/');
    }
  };
  walk(root);
  return found.sort();
}

it('each language has its own folder, named by its address prefix, with a root layout, a 404 page and an error page', () => {
  expect(LOCALES.map(l => ROOT[l])).toEqual(['(zh-hant)', ...(['zh-Hans', 'en'] as const).map(l => LOCALE_SEGMENT[l])]);
  for (const locale of LOCALES) {
    expect(existsSync(join(__dirname, ROOT[locale], 'layout.tsx')), locale).toBe(true);
    expect(existsSync(join(__dirname, ROOT[locale], 'not-found.tsx')), locale).toBe(true);
    expect(existsSync(join(__dirname, ROOT[locale], 'error.tsx')), locale).toBe(true);
  }
  // No page or layout outside them: every address belongs to exactly one language.
  const top = readdirSync(__dirname, { withFileTypes: true });
  expect(top.filter(e => e.isDirectory()).map(e => e.name).sort()).toEqual(['(zh-hant)', '_site', 'en', 'zh-hans']);
  expect(top.some(e => e.name.startsWith('page.') || e.name.startsWith('layout.') || e.name.startsWith('not-found.'))).toBe(false);
});

it('every page exists in all three languages, at the same path', () => {
  expect(pagePaths('zh-Hant')).toEqual(['/', '/about', '/chain', '/operators', '/operators/[id]', '/saved', '/tours', '/tours/[id]']);
  for (const locale of LOCALES) expect(pagePaths(locale), locale).toEqual(pagePaths('zh-Hant'));
});

/** Pages that are never in the sitemap: the saved page is the visitor's own list (and noindex). */
const NOT_IN_SITEMAP = ['/saved'];

it('the sitemap lists every page in every language but the saved page: the fixed ones, /tours/[id] for each destination with a page of its own, and /operators/[id] for each operator listing tours', async () => {
  const listed = (await sitemap()).map(entry => entry.url).sort();
  const paths = pagePaths('zh-Hant').filter(path => !NOT_IN_SITEMAP.includes(path)).flatMap(path =>
    path === '/tours/[id]' ? listedDestinations(places, counts).map(destinationPath)
      : path === '/operators/[id]' ? operators.filter(isOperatorListed).map(o => operatorPath(o.id))
        : [path]);
  expect(listed.some(url => url.includes('/saved'))).toBe(false);
  expect(paths).toContain('/tours/japan-kansai');
  expect(paths).toEqual(expect.arrayContaining(['/operators', '/operators/egl', '/operators/texpert']));
  expect(paths).not.toContain('/operators/jetour');
  const expected = LOCALES.flatMap(locale => paths.map(path => siteUrl(localeHref(locale, path)))).sort();
  expect(listed).toEqual(expected);
});

type RouteModule = {
  default: (props: Record<string, unknown>) => ReactElement<Record<string, unknown>> | Promise<ReactElement<Record<string, unknown>>>;
  generateMetadata?: (props: Record<string, unknown>) => unknown;
  metadata?: unknown;
  revalidate?: unknown;
};

const routes = (await Promise.all([
  ['zh-Hant', import('./(zh-hant)/layout'), import('./(zh-hant)/page'), import('./(zh-hant)/chain/page'),
    import('./(zh-hant)/tours/page'), import('./(zh-hant)/tours/[id]/page'), import('./(zh-hant)/about/page'), import('./(zh-hant)/saved/page'),
    import('./(zh-hant)/operators/page'), import('./(zh-hant)/operators/[id]/page'), import('./(zh-hant)/not-found')],
  ['zh-Hans', import('./zh-hans/layout'), import('./zh-hans/page'), import('./zh-hans/chain/page'),
    import('./zh-hans/tours/page'), import('./zh-hans/tours/[id]/page'), import('./zh-hans/about/page'), import('./zh-hans/saved/page'),
    import('./zh-hans/operators/page'), import('./zh-hans/operators/[id]/page'), import('./zh-hans/not-found')],
  ['en', import('./en/layout'), import('./en/page'), import('./en/chain/page'),
    import('./en/tours/page'), import('./en/tours/[id]/page'), import('./en/about/page'), import('./en/saved/page'),
    import('./en/operators/page'), import('./en/operators/[id]/page'), import('./en/not-found')],
].map(async ([locale, ...modules]) => [locale, ...(await Promise.all(modules))]))) as [Locale, ...RouteModule[]][];

it.each(routes)('%s: the layout and every page pass that language (and their params and query), and their metadata is that language\'s', async (locale, layout, search, chain, tours, destination, about, saved, operatorsIndex, operator, notFound) => {
  const searchParams = Promise.resolve({ dmin: '5' });
  const params = Promise.resolve({ id: 'japan' });
  const children = 'page';
  const site = {
    frame: await import('./_site/site-frame'), search: await import('./_site/search-page'), chain: await import('./_site/chain-page'),
    tours: await import('./_site/tours-page'), destination: await import('./_site/destination-page'),
    about: await import('./_site/about-page'), saved: await import('./_site/saved-page'), notFound: await import('./_site/not-found-page'),
    operators: await import('./_site/operators-page'), operator: await import('./_site/operator-page'),
  };
  const frame = await layout.default({ children });
  expect(frame.type).toBe(site.frame.SiteFrame);
  expect(frame.props).toEqual({ locale, children });

  const cases: [RouteModule, unknown, Record<string, unknown>, Record<string, unknown>][] = [
    [search, site.search.SearchPage, { searchParams }, { page: 'search', locale, searchParams }],
    [chain, site.chain.ChainPage, { searchParams }, { page: 'chain', locale, searchParams }],
    [tours, site.tours.ToursPage, {}, { page: 'tours', locale }],
    [destination, site.destination.DestinationPage, { params, searchParams }, { page: 'destination', locale, params, searchParams }],
    [about, site.about.AboutPage, {}, { page: 'about', locale }],
    [saved, site.saved.SavedPage, { searchParams }, { page: 'saved', locale }],
    [operatorsIndex, site.operators.OperatorsPage, {}, { page: 'operators', locale }],
    [operator, site.operator.OperatorPage, { params, searchParams }, { page: 'operator', locale, params, searchParams }],
  ];
  for (const [route, Page, props, metadata] of cases) {
    const page = await route.default({ ...props });
    expect(page.type).toBe(Page);
    expect(page.props).toEqual({ locale, ...props });
    expect(route.generateMetadata!({ params, searchParams })).toEqual(metadata);
  }
  expect(layout.generateMetadata!({})).toEqual({ frame: true, locale });

  const notFoundPage = await notFound.default({});
  expect(notFoundPage.type).toBe(site.notFound.NotFoundPage);
  expect(notFoundPage.props).toEqual({ locale });
  expect(notFound.metadata).toEqual({ page: 'not-found', locale });
});

it.each(routes)('%s: the two indexes are stored copies, made again at most once an hour (revalidate 3600, a literal as Next.js requires); no other page or layout sets revalidate', (_locale, layout, search, chain, tours, destination, about, saved, operatorsIndex, operator, notFound) => {
  expect(tours.revalidate).toBe(3600);
  expect(operatorsIndex.revalidate).toBe(3600);
  for (const other of [layout, search, chain, destination, about, saved, operator, notFound]) expect(other).not.toHaveProperty('revalidate');
});
