import Link from 'next/link';
import type { T } from '../lib/i18n';
import { localeHref } from '../lib/locale-path';
import { siteIdentity } from '../lib/site-identity';
import { TOURS_PATH } from '../lib/destinations';
import styles from './Footer.module.css';

/** The footer's links (in the footer's language): the destinations index and the about page, on every page. */
const LINKS = [
  { path: TOURS_PATH, label: 'footer.destinations' },
  { path: '/about', label: 'footer.about' },
] as const;

/** A server component: the contact address is CONTACT_EMAIL (lib/site-identity.ts). */
export function Footer({ t }: { t: T }) {
  const { contactEmail } = siteIdentity();
  // The contact sentence with its {email} placeholder left as written, so the address can be a link.
  const [beforeEmail, afterEmail = ''] = t('footer.contact').split('{email}');
  return (
    <footer className={styles.footer}>
      <p className={styles.text}>{t('footer.disclaimer')}</p>
      <p className={`${styles.text} ${styles.contact}`}>
        {beforeEmail}<a className={styles.link} href={`mailto:${contactEmail}`}>{contactEmail}</a>{afterEmail}
      </p>
      <nav className={styles.links} aria-label={t('footer.links')}>
        {LINKS.map(({ path, label }) => (
          <Link key={path} className={styles.link} href={localeHref(t.locale, path)}>{t(label)}</Link>
        ))}
      </nav>
    </footer>
  );
}
