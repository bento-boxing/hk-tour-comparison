import type { Metadata } from 'next';
import { SiteLink } from '../../components/SiteLink';
import { places } from '@hktours/core';
import { makeT, type Locale } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import { pageMetadata } from '../../lib/site-metadata';
import { placeName } from '../../lib/place-names';
import { TOURS_PATH, destinationDirectory, destinationPath } from '../../lib/destinations';
import { OPERATORS_PATH } from '../../lib/operators';
import { phoneCell, phoneFitCss, type PhoneCell } from '../../lib/directory-cells';
import { formatCount } from '../../lib/format';
import { breadcrumbJsonLd } from '../../lib/structured-data';
import { JsonLd } from '../../components/JsonLd';
import { loadStoredCounts } from './page-data';
import frame from './site-frame.module.css';
import styles from './tours-page.module.css';

/**
 * Its own title and description. Never noindex: the page is a stored copy, never made when the counts cannot be read
 * (its loader throws), so no page saying "cannot read" exists to keep out of search results.
 */
export async function toursPageMetadata(locale: Locale): Promise<Metadata> {
  const t = makeT(locale);
  return pageMetadata(t, TOURS_PATH, { title: t('tours.title'), description: t('tours.description') });
}

/**
 * The destinations index in `locale` (/tours: app/(zh-hant)/tours/page.tsx and the same in app/zh-hans and app/en), as
 * a directory (drawing D1): every destination with a page of its own (lib/destinations.ts isListed), each a link with
 * its count of tours. This is how crawlers (and some people) reach the destination pages; people mostly choose with
 * the picker and the band's shortcuts.
 * - The heading with the line of counts and the link to the operators index beside it (below it on a phone).
 * - A row of jump links, one per part of the world, each to its section on this page.
 * - Each part of the world under a 2px rule: its countries with listed regions, one line each (the country and its
 *   count, then its regions in columns), then its countries without regions together in one grid; most tours first
 *   (lib/destinations.ts destinationDirectory). A region's count is the number alone, as in the drawing; every count
 *   groups thousands ('1,234'), as the line of counts does.
 * - On phones a region, or a country without regions, whose name and count need more than its column's least width
 *   takes the whole row (.long), except where its column is wide enough for it: container queries for each such cell,
 *   in a <style> after the sections (lib/directory-cells.ts phoneCell and phoneFitCss).
 * - A jump moves the keyboard's focus to the section (tabindex -1), so the next Tab goes on from there.
 * A stored copy (the route files' `revalidate`): when the counts cannot be read it throws, and is not made. Nothing
 * here may read the request (no searchParams, cookies or headers), or the page would be made per request.
 */
export async function ToursPage({ locale }: { locale: Locale }) {
  const t = makeT(locale);
  const load = await loadStoredCounts();
  const { all } = load.data;
  const groups = destinationDirectory(places, load.data);
  /** The marks of the cells that can take the whole row on phones, for their container queries. */
  const marks = new Set<string>();
  /** A cell's class and mark: its own class, and .long with its mark when it can take the whole row on phones. */
  const cell = (own: string, phone: PhoneCell) => {
    if (phone.fit) marks.add(phone.fit);
    return { className: phone.long ? `${own} ${styles.long}` : own, 'data-fit': phone.fit };
  };
  const sections = groups.map(group => (
    // Every count groups thousands ('1,234 團', a region's '1,234'), as the line of counts above: the columns (the
    // stylesheet's widths, and phoneCell's sums for the phones' queries) hold the comma of a four-digit count.
    <section key={group.id} id={group.id} tabIndex={-1} className={styles.group} aria-labelledby={`group-${group.id}`}>
      <h2 id={`group-${group.id}`} className={styles.groupHeading}>{t(`countryGroup.${group.id}`)}</h2>
      <div>
        {group.withRegions.length > 0 && (
          <ul className={styles.countries}>
            {group.withRegions.map(({ country, destination, count, regions }) => (
              <li key={country.id} className={styles.country}>
                <p className={styles.countryLine}>
                  <SiteLink className={styles.countryLink} href={localeHref(t.locale, destinationPath(destination))}>{placeName(country, t.locale)}</SiteLink>
                  {' '}<span className={styles.count}>{t('dest.tours', { n: formatCount(count.tours) })}</span>
                </p>
                <ul className={styles.regions}>
                  {regions.map(r => (
                    <li key={r.region.id} {...cell(styles.region, phoneCell('region', t.locale, placeName(r.region, t.locale), r.count.tours))}>
                      <SiteLink className={styles.regionLink} href={localeHref(t.locale, destinationPath(r.destination))}>{placeName(r.region, t.locale)}</SiteLink>
                      {' '}<span className={styles.regionCount}>{formatCount(r.count.tours)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {group.withoutRegions.length > 0 && (
          <ul className={styles.plain}>
            {group.withoutRegions.map(({ country, destination, count }) => (
              <li key={country.id} {...cell(styles.plainCountry, phoneCell('plain', t.locale, placeName(country, t.locale), count.tours))}>
                <SiteLink className={styles.countryLink} href={localeHref(t.locale, destinationPath(destination))}>{placeName(country, t.locale)}</SiteLink>
                {' '}<span className={styles.count}>{t('dest.tours', { n: formatCount(count.tours) })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  ));
  return (
    <div className={`${frame.wrap} ${frame.page} ${styles.page}`}>
      <div className={styles.top}>
        <h1 className={styles.heading}>{t('tours.title')}</h1>
        {/* Never "no tours": the stored loader throws on an empty answer. */}
        <p className={styles.summary}>{t('dest.count', { tours: formatCount(all.tours), operators: formatCount(all.operators) })}</p>
        {/* Its own item, never after a separator: no line ever starts with one. */}
        <p className={styles.browseLine}><SiteLink className={styles.browse} href={localeHref(t.locale, OPERATORS_PATH)}>{t('tours.byOperator')}</SiteLink></p>
      </div>
      {/* In-page anchors: plain links, nothing to load. */}
      <nav className={styles.jump} aria-label={t('tours.jumpTo')}>
        {groups.map(group => (
          <a key={group.id} className={styles.jumpLink} href={`#${group.id}`}>{t(`countryGroup.${group.id}`)}</a>
        ))}
      </nav>
      {sections}
      {/* Its rules (.long with a mark) outweigh .long, wherever a column is wide enough; nothing in them is escaped. */}
      {marks.size > 0 && <style>{phoneFitCss(marks, styles.long)}</style>}
      <JsonLd data={breadcrumbJsonLd(t, [{ name: t('tours.title'), path: TOURS_PATH }])} />
    </div>
  );
}
