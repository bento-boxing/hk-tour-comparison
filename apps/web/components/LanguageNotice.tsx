import type { T } from '../lib/i18n';
import styles from './LanguageNotice.module.css';

/**
 * The permanent notice shown in every language but Traditional Chinese: fixed to the top of the window above
 * everything else, never dismissed. A role="note", not an alert, so screen readers do not announce it on
 * every page. An invisible copy in the page flow (same text, same box) reserves exactly its height at any
 * width, however many lines it wraps to, so the nav bar and the page start below it, from the first paint.
 */
export function LanguageNotice({ t }: { t: T }) {
  if (t.locale === 'zh-Hant') return null;
  const text = t('notice.cantonese');
  return (
    <>
      <p role="note" className={`${styles.notice} ${styles.fixed}`}>{text}</p>
      <p aria-hidden="true" className={`${styles.notice} ${styles.spacer}`} data-notice-spacer="">{text}</p>
    </>
  );
}
