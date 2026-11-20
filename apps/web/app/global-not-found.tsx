import type { Metadata } from 'next';
import '../lib/theme.css';
import { HTML_LANG, LOCALES, makeT } from '../lib/i18n';
import { HREFLANG, localeHref } from '../lib/locale-path';
import { Mark } from '../components/Mark';
import styles from './global-not-found.module.css';

const zh = makeT('zh-Hant');

/** Next.js adds <meta name="robots" content="noindex"> to a 404 by itself. */
export const metadata: Metadata = { title: `${zh('notFound.title')} | ${zh('site.name')}` };

/**
 * The 404 page for every address no page answers ('/fr', '/EN', '/zh-Hans', '/en/nothing'), with the 404 status.
 * Each language has its own root layout, so there is no one layout for a 404 page; Next.js serves this whole
 * document instead (experimental.globalNotFound in next.config.ts). Such an address has no language of its own,
 * so the page guesses none: it says so in all three, each with a link to the search page in that language.
 * The theme follows the system setting (theme.css), as for a visitor who never chose one.
 */
export default function GlobalNotFound() {
  return (
    <html lang={HTML_LANG['zh-Hant']}>
      <body>
        <header className={styles.bar}>
          <div className={styles.barInner}><b className={styles.name}><Mark className={styles.mark} />{zh('site.name')}</b></div>
        </header>
        <main className={styles.content}>
          {LOCALES.map((locale, i) => {
            const t = makeT(locale);
            const Heading = i === 0 ? 'h1' : 'h2';
            return (
              <section key={locale} lang={HTML_LANG[locale]} className={styles.block}>
                <Heading className={styles.heading}>{t('notFound.title')}</Heading>
                <a className={styles.link} href={localeHref(locale, '/')} hrefLang={HREFLANG[locale]}>{t('nav.search')}</a>
              </section>
            );
          })}
        </main>
      </body>
    </html>
  );
}
