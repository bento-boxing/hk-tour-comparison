import type { Metadata } from 'next';
import { SiteLink } from '../../components/SiteLink';
import { NoCurrentTab } from '../../components/TabBar';
import { makeT, type Locale } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import { TOURS_PATH } from '../../lib/destinations';
import frame from './site-frame.module.css';
import styles from './not-found-page.module.css';

/** The 404's title in its language. Next.js adds <meta name="robots" content="noindex"> to a 404 by itself. */
export function notFoundMetadata(locale: Locale): Metadata {
  return { title: makeT(locale)('notFound.title') };
}

/**
 * The 404 inside a language's pages, in that language's frame (app/(zh-hant)/not-found.tsx, app/zh-hans/not-found.tsx,
 * app/en/not-found.tsx): what a page shows when it calls notFound(), as a destination's page does for an id that is
 * no destination ('/en/tours/atlantis'). Addresses no page answers at all ('/fr') get app/global-not-found.tsx.
 */
export function NotFoundPage({ locale }: { locale: Locale }) {
  const t = makeT(locale);
  return (
    <div className={`${frame.wrap} ${frame.page}`}>
      {/* Its address may look like a destination's ('/tours/atlantis'): the bottom bar marks no tab. */}
      <NoCurrentTab />
      <div className={styles.notFound}>
        <h1 className={styles.heading}>{t('notFound.title')}</h1>
        <p className={styles.text}>{t('notFound.text')}</p>
        <p className={styles.links}>
          <SiteLink className={styles.link} href={localeHref(t.locale, '/')}>{t('nav.search')}</SiteLink>
          <SiteLink className={styles.link} href={localeHref(t.locale, TOURS_PATH)}>{t('footer.destinations')}</SiteLink>
        </p>
      </div>
    </div>
  );
}
