import Link from 'next/link';
import type { T } from '../lib/i18n';
import { LanguageSwitch } from './LanguageSwitch';
import { Mark } from './Mark';
import { ThemeSwitch } from './ThemeSwitch';
import styles from './NavBar.module.css';

export type NavPage = 'search' | 'chain';

const links: { page: NavPage; href: string; label: 'nav.search' | 'nav.chain' }[] = [
  { page: 'search', href: '/', label: 'nav.search' },
  { page: 'chain', href: '/chain', label: 'nav.chain' },
];

/**
 * The site's top bar (mockup `.bar`): mark and name, the two page links, and the language and theme switches at
 * the right. The bar is dark in both themes.
 * `current` is the page whose link is highlighted, if any.
 */
export function NavBar({ current, t }: { current?: NavPage; t: T }) {
  return (
    <nav className={styles.bar}>
      <div className={styles.inner}>
        <b className={styles.name}><Mark className={styles.mark} />{t('site.name')}</b>
        {links.map(({ page, href, label }) => (
          <Link
            key={page}
            href={href}
            className={page === current ? `${styles.link} ${styles.current}` : styles.link}
            aria-current={page === current ? 'page' : undefined}
          >
            {t(label)}
          </Link>
        ))}
        <div className={styles.tools}>
          <LanguageSwitch t={t} />
          <ThemeSwitch t={t} />
        </div>
      </div>
    </nav>
  );
}
