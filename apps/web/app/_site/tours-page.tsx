import type { Metadata } from 'next';
import { SiteLink } from '../../components/SiteLink';
import { places } from '@hktours/core';
import { makeT, type Locale } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import { pageMetadata } from '../../lib/site-metadata';
import { placeName } from '../../lib/place-names';
import { TOURS_PATH, destinationIndex, destinationPath } from '../../lib/destinations';
import { OPERATORS_PATH } from '../../lib/operators';
import { loadCounts } from './page-data';
import frame from './site-frame.module.css';
import styles from './tours-page.module.css';

/** Its own title and description; marked noindex when the counts could not be read. */
export async function toursPageMetadata(locale: Locale): Promise<Metadata> {
  const t = makeT(locale);
  const load = await loadCounts();
  return pageMetadata(t, TOURS_PATH, { title: t('tours.title'), description: t('tours.description'), noindex: !load.ok });
}

/**
 * The destinations index in `locale` (/tours: app/(zh-hant)/tours/page.tsx and the same in app/zh-hans and app/en):
 * every destination with a page of its own (lib/destinations.ts isListed), arranged as the country picker arranges
 * countries, each a link with its count of tours. This is how people and crawlers reach the destination pages. The
 * line of counts ends with a link to the operators index.
 */
export async function ToursPage({ locale }: { locale: Locale }) {
  const t = makeT(locale);
  const load = await loadCounts();
  if (!load.ok) {
    return (
      <div className={`${frame.wrap} ${frame.page}`}>
        <h1 className={styles.heading}>{t('tours.title')}</h1>
        <p className={styles.error} role="alert">{t('search.error')}</p>
      </div>
    );
  }
  const { all } = load.data;
  const groups = destinationIndex(places, load.data);
  return (
    <div className={`${frame.wrap} ${frame.page}`}>
      <h1 className={styles.heading}>{t('tours.title')}</h1>
      <p className={styles.summary}>{all.tours > 0 ? t('dest.count', { tours: all.tours, operators: all.operators }) : t('dest.countNone')}</p>
      {/* On its own line, at every width: no line ever starts with a separator. */}
      <p className={styles.browseLine}><SiteLink className={styles.browse} href={localeHref(t.locale, OPERATORS_PATH)}>{t('tours.byOperator')}</SiteLink></p>
      {groups.map(group => (
        <section key={group.id} className={styles.group} aria-labelledby={`group-${group.id}`}>
          <h2 id={`group-${group.id}`} className={styles.groupHeading}>{t(`countryGroup.${group.id}`)}</h2>
          <ul className={styles.countries}>
            {group.countries.map(({ country, destination, count, regions }) => (
              <li key={country.id} className={styles.country}>
                <SiteLink className={styles.countryLink} href={localeHref(t.locale, destinationPath(destination))}>{placeName(country, t.locale)}</SiteLink>
                {' '}<span className={styles.count}>{t('dest.tours', { n: count.tours })}</span>
                {regions.length > 0 && (
                  <ul className={styles.regions}>
                    {regions.map(r => (
                      <li key={r.region.id}>
                        <SiteLink className={styles.regionLink} href={localeHref(t.locale, destinationPath(r.destination))}>{placeName(r.region, t.locale)}</SiteLink>
                        {' '}<span className={styles.count}>{t('dest.tours', { n: r.count.tours })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
