import Link from 'next/link';
import type { T } from '../lib/i18n';
import { localeHref } from '../lib/locale-path';
import { siteIdentity } from '../lib/site-identity';
import { TOURS_PATH } from '../lib/destinations';
import { OPERATORS_PATH } from '../lib/operators';
import styles from './Footer.module.css';

/** The footer's links (in the footer's language): the destinations and operators indexes and the about page, on every page. */
const LINKS = [
  // The header's label: the same words in Chinese (所有目的地), and short in English (Destinations), so the three links
  // keep to one line on a 320px phone.
  { path: TOURS_PATH, label: 'nav.destinations' },
  { path: OPERATORS_PATH, label: 'footer.operators' },
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
