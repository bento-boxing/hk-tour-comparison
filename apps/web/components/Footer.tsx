import Link from 'next/link';
import { CONTACT_EMAIL } from '@hktours/core';
import type { T } from '../lib/i18n';
import { localeHref } from '../lib/locale-path';
import { TOURS_PATH } from '../lib/destinations';
import styles from './Footer.module.css';

/** The footer's links (in the footer's language): the destinations index and the about page, on every page. */
const LINKS = [
  { path: TOURS_PATH, label: 'footer.destinations' },
  { path: '/about', label: 'footer.about' },
] as const;

export function Footer({ t }: { t: T }) {
  // The contact sentence with its {email} placeholder left as written, so the address can be a link.
  const [beforeEmail, afterEmail = ''] = t('footer.contact').split('{email}');
  return (
    <footer className={styles.footer}>
      <p className={styles.text}>{t('footer.disclaimer')}</p>
      <p className={`${styles.text} ${styles.contact}`}>
        {beforeEmail}<a className={styles.link} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{afterEmail}
      </p>
      <nav className={styles.links} aria-label={t('footer.links')}>
        {LINKS.map(({ path, label }) => (
          <Link key={path} className={styles.link} href={localeHref(t.locale, path)}>{t(label)}</Link>
        ))}
      </nav>
    </footer>
  );
}
