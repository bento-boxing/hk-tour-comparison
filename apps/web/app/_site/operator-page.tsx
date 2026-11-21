import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { places, type OperatorId } from '@hktours/core';
import type { OperatorListing } from '@hktours/db/read';
import { makeT, type Locale, type T } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import { pageMetadata } from '../../lib/site-metadata';
import { operatorName } from '../../lib/place-names';
import { formatCount } from '../../lib/format';
import { staleSince } from '../../lib/card-text';
import {
  isOperatorListed, joinNames, officialSiteUrl, operatorFromId, operatorPath, operatorPlaces, operatorSearchHref,
} from '../../lib/operators';
import { FixedOperatorProvider } from '../../lib/search-address';
import { loadOperator, queryOf, type Loaded, type OperatorPageData, type SearchParams } from './page-data';
import { SearchBand } from './search-band';
import { SearchError, SearchList } from './search-page';
import { KeepClauses } from './keep-clauses';
import frame from './site-frame.module.css';
import styles from './operator-page.module.css';

type Params = Promise<{ id: string }>;

/** The operator the path names; a real 404 (not-found.tsx in the page's language) for anything else, before any read. */
async function operatorOf(params: Params): Promise<OperatorId> {
  const operator = operatorFromId((await params).id);
  if (!operator) notFound();
  return operator;
}

/**
 * The operator's listing from a load that worked; a 404 when the site does not list it (not in the database, or never
 * had a good run: such an operator exists nowhere on the site). Its tours are not read in that case.
 */
function listingOf(load: Extract<Loaded<OperatorPageData>, { ok: true }>): OperatorListing {
  const { listing } = load.data;
  if (!listing) notFound();
  return listing;
}

/** One plain sentence on what the site is, then one from the data: how many tours, and the countries most go to. */
function operatorDescription(t: T, listing: OperatorListing): string {
  const operator = operatorName(listing, t.locale);
  if (listing.tours === 0) return t('operator.descriptionNone', { operator });
  const names = operatorPlaces(listing, places, t.locale);
  const tours = formatCount(listing.tours);
  return names.length > 0
    ? t('operator.description', { operator, tours, places: joinNames(names, t.locale) })
    : t('operator.descriptionNoPlaces', { operator, tours });
}

/**
 * Titled in the owner's form ('專業旅運旅行團一覽｜跟邊團', 'Group tours from Travel Expert | 跟邊團') and described
 * by what the site is and then the data; canonical: this language's address of the operator's page without the query
 * string; the page in the other languages as alternates. Marked noindex when the operator lists no tours now, or when
 * the database could not be read (then titled with the site name alone: the operator's name is not known, and the
 * page is not the index).
 */
export async function operatorPageMetadata(locale: Locale, params: Params, searchParams: Promise<SearchParams>): Promise<Metadata> {
  const operator = await operatorOf(params);
  const t = makeT(locale);
  const load = await loadOperator(locale, operator, queryOf(await searchParams));
  if (!load.ok) return pageMetadata(t, operatorPath(operator), { noindex: true });
  const listing = listingOf(load);
  return pageMetadata(t, operatorPath(operator), {
    fullTitle: t('operator.title', { operator: operatorName(listing, locale), site: t('site.name') }),
    description: operatorDescription(t, listing),
    noindex: !isOperatorListed(listing),
  });
}

/**
 * An operator's page in `locale` (/operators/<id>: app/(zh-hant)/operators/[id]/page.tsx and the same in app/zh-hans
 * and app/en): the search page with the operator fixed by the path. The gold band names the operator and counts its
 * tours, says this is not the operator's site, links to the operator's own home page and, when its data is old, says
 * so once; then the search page's list. Every filter (the destination among them) stays in the query string on this
 * same path (/operators/egl?dest=japan&dmin=5), and no filter can change the operator. An operator with no tours now
 * gets the band without its search, then one line saying so with a link to every tour: nothing to filter or sort.
 */
export async function OperatorPage({ locale, params, searchParams }: { locale: Locale; params: Params; searchParams: Promise<SearchParams> }) {
  const operator = await operatorOf(params);
  const t = makeT(locale);
  const load = await loadOperator(locale, operator, queryOf(await searchParams));
  if (!load.ok) {
    // Neutral: the operator's name is not known, and this is not the operators index.
    return (
      <>
        <SearchBand t={t} heading={t('site.name')} />
        <SearchError t={t} />
      </>
    );
  }
  const listing = listingOf(load);
  const { search } = load.data;
  const name = operatorName(listing, t.locale);
  const heading = t('operator.heading', { operator: name });
  const notes = <OperatorNotes t={t} listing={listing} now={load.now} />;
  if (search === null) {
    return (
      <>
        <SearchBand t={t} heading={heading} related={notes} />
        <div className={`${frame.wrap} ${frame.page}`}>
          <p className={styles.none}>
            {t('operator.none', { operator: name })}{' '}
            <Link className={styles.allTours} href={localeHref(t.locale, '/')}>{t('operator.allTours')}</Link>
          </p>
        </div>
      </>
    );
  }
  return (
    // The band's destination search and the filter row record their choices on this page (lib/search-address.tsx).
    <FixedOperatorProvider operator={operator}>
      {/* No destination shortcuts: they lead to the destinations' own pages, away from this operator. */}
      <SearchBand
        t={t} heading={heading} state={search.state}
        line={t('operator.count', { tours: formatCount(listing.tours) })}
        related={notes}
      />
      <SearchList
        t={t} data={search} today={load.today} now={load.now} clearPath={operatorPath(operator)}
        hrefFor={state => operatorSearchHref(operator, state)} updatedFrom={[listing]}
      />
    </FixedOperatorProvider>
  );
}

/**
 * Under the heading: that this page is not the operator's website and the site is not connected with it (in Chinese,
 * wrapping only between its two clauses); the link to the operator's own home page (a new tab, without a Referer, as
 * the rows' links; the words after the name kept together, so a break comes after the name); and, when the operator's
 * last good run is older than the rows allow (lib/card-text.ts staleSince), the rows' note.
 */
function OperatorNotes({ t, listing, now }: { t: T; listing: OperatorListing; now: string }) {
  const name = operatorName(listing, t.locale);
  const officialSite = officialSiteUrl(listing.siteUrl);
  const staleDay = listing.lastGoodRunAt === null ? null : staleSince(listing.lastGoodRunAt, now, t);
  // The link's text around the name: '去' + name + '的官方網站 ↗', name + ' official site ↗'.
  const [before, after = ''] = t('operator.official').split('{operator}');
  const gap = /^\s*/.exec(after)![0];
  return (
    <div className={styles.notes}>
      <p className={styles.notOfficial}><KeepClauses text={t('operator.notOfficial', { operator: name })} locale={t.locale} /></p>
      {(officialSite !== null || staleDay !== null) && (
        <p className={styles.actions}>
          {officialSite !== null && (
            <a className={styles.official} href={officialSite} target="_blank" rel="noopener noreferrer">
              {/* One flex item, so its words wrap as one line of text inside the button. */}
              <span>{before}{name}{gap}<span className={styles.keep}>{after.slice(gap.length)}</span></span>
            </a>
          )}
          {staleDay !== null && <span className={styles.stale}>{t('row.stale', { date: staleDay })}</span>}
        </p>
      )}
    </div>
  );
}
