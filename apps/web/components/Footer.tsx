import { CONTACT_EMAIL } from '@hktours/core';
import type { T } from '../lib/i18n';
import styles from './Footer.module.css';

export function Footer({ t }: { t: T }) {
  // The contact sentence with its {email} placeholder left as written, so the address can be a link.
  const [beforeEmail, afterEmail = ''] = t('footer.contact').split('{email}');
  return (
    <footer className={styles.footer}>
      <p className={styles.text}>{t('footer.disclaimer')}</p>
      <p className={`${styles.text} ${styles.contact}`}>
        {beforeEmail}<a className={styles.link} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{afterEmail}
      </p>
    </footer>
  );
}
