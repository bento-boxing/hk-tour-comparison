import type { Metadata } from 'next';
import { SiteLink } from '../../components/SiteLink';
import { makeT, type Locale } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import { pageMetadata } from '../../lib/site-metadata';
import { operatorName } from '../../lib/place-names';
import { operatorTagStyle } from '../../lib/contrast';
import { formatCount } from '../../lib/format';
import { TOURS_PATH } from '../../lib/destinations';
import { OPERATORS_PATH, operatorPath } from '../../lib/operators';
import { loadStoredOperatorListings } from './page-data';
import { KeepClauses } from './keep-clauses';
import frame from './site-frame.module.css';
import tours from './tours-page.module.css';
import styles from './operators-page.module.css';

/**
 * Its own title (with ' | ' as every page but the operators' own) and description. Never noindex: the page is a
 * stored copy, never made when the operators cannot be read (its loader throws).
 */
export async function operatorsPageMetadata(locale: Locale): Promise<Metadata> {
  const t = makeT(locale);
  return pageMetadata(t, OPERATORS_PATH, { title: t('operators.heading'), description: t('operators.description') });
}

/**
 * The operators index in `locale` (/operators: app/(zh-hant)/operators/page.tsx and the same in app/zh-hans and
 * app/en): the destinations index's heading and line of counts (with a link to that index), the line saying this site
 * is no operator's, then every operator the site lists (known, with a good run: one with no tours now shows 0), in
 * the site's order, each a box linking to its page: its name in its coloured tag (as the rows show it) and how many
 * tours it lists now. No logos, no operator text.
 * A stored copy (the route files' `revalidate`): when the operators cannot be read it throws, and is not made.
 */
export async function OperatorsPage({ locale }: { locale: Locale }) {
  const t = makeT(locale);
  const load = await loadStoredOperatorListings();
  const listings = load.data;
  // Every tour has one operator, so the operators' counts add up to every listed tour.
  const all = { tours: listings.reduce((n, o) => n + o.tours, 0), operators: listings.filter(o => o.tours > 0).length };
  return (
    <div className={`${frame.wrap} ${frame.page}`}>
      <h1 className={tours.heading}>{t('operators.heading')}</h1>
      {/* Never "no tours": the stored loader throws when no operator lists tours. */}
      <p className={tours.summary}>{t('dest.count', { tours: formatCount(all.tours), operators: formatCount(all.operators) })}</p>
      {/* On its own line, at every width: no line ever starts with a separator. */}
      <p className={tours.browseLine}><SiteLink className={tours.browse} href={localeHref(t.locale, TOURS_PATH)}>{t('operators.byDestination')}</SiteLink></p>
      <p className={styles.notOfficial}><KeepClauses text={t('operators.notOfficial')} locale={t.locale} /></p>
      <ul className={styles.operators}>
        {listings.map(listing => {
          const { style, dark } = operatorTagStyle(listing.color);
          return (
            <li key={listing.id}>
              <SiteLink className={styles.operator} href={localeHref(t.locale, operatorPath(listing.id))}>
                <span
                  className={dark ? `${styles.tag} ${styles.tagDark}` : styles.tag}
                  style={style}
                >
                  {operatorName(listing, t.locale)}
                </span>
                <span className={styles.count}>{t('dest.tours', { n: formatCount(listing.tours) })}</span>
              </SiteLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
