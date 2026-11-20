import Link from 'next/link';
import type { T } from '../lib/i18n';
import { localeHref } from '../lib/locale-path';
import { TOURS_PATH } from '../lib/destinations';
import { LanguageSwitch } from './LanguageSwitch';
import { Mark } from './Mark';
import { ThemeSwitch } from './ThemeSwitch';
import styles from './NavBar.module.css';

export type NavPage = 'search' | 'chain' | 'destinations';

/** The pages' paths without a language; each link gets the bar's language (localeHref). */
const links: { page: NavPage; path: string; label: 'nav.search' | 'nav.chain' | 'nav.destinations' }[] = [
  { page: 'search', path: '/', label: 'nav.search' },
  { page: 'chain', path: '/chain', label: 'nav.chain' },
  { page: 'destinations', path: TOURS_PATH, label: 'nav.destinations' },
];

/**
 * The site's header bar (mock-up Rows): the mark and name (a link to the search page), the three page links (in the
 * bar's language, the current one bold with a gold underline), then the language and theme switches at the right.
 * The bar is ink in the light theme and near-black in the dark one. On a phone it is two rows: the name and the
 * switches, then the three links.
 * `current` is the page whose link is highlighted, if any.
 */
export function NavBar({ current, t }: { current?: NavPage; t: T }) {
  return (
    <nav className={styles.bar}>
      <div className={styles.inner}>
        <Link href={localeHref(t.locale, '/')} className={styles.name}><Mark className={styles.mark} />{t('site.name')}</Link>
        <div className={styles.links}>
          {links.map(({ page, path, label }) => (
            <Link
              key={page}
              href={localeHref(t.locale, path)}
              className={page === current ? `${styles.link} ${styles.current}` : styles.link}
              aria-current={page === current ? 'page' : undefined}
            >
              {t(label)}
            </Link>
          ))}
        </div>
        <div className={styles.tools}>
          <LanguageSwitch t={t} />
          <ThemeSwitch t={t} />
        </div>
      </div>
    </nav>
  );
}
