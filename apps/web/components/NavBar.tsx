import Link from 'next/link';
import type { T } from '../lib/i18n';
import styles from './NavBar.module.css';

export type NavPage = 'search' | 'chain';

const links: { page: NavPage; href: string; label: 'nav.search' | 'nav.chain' }[] = [
  { page: 'search', href: '/', label: 'nav.search' },
  { page: 'chain', href: '/chain', label: 'nav.chain' },
];

/** The site's top bar (mockup `.bar`). `current` is the page whose link is highlighted, if any. */
export function NavBar({ current, t }: { current?: NavPage; t: T }) {
  return (
    <nav className={styles.bar}>
      <div className={styles.inner}>
        <b className={styles.name}>{t('site.name')}</b>
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
      </div>
    </nav>
  );
}
