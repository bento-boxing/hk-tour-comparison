import type { T } from '../lib/i18n';
import styles from './Footer.module.css';

export function Footer({ t }: { t: T }) {
  return (
    <footer className={styles.footer}>
      <p className={styles.text}>{t('footer.disclaimer')}</p>
    </footer>
  );
}
