'use client';

import type { T } from '../lib/i18n';
import type { Theme } from '../lib/theme';
import { setTheme } from '../lib/theme-action';
import styles from './ThemeSwitch.module.css';

/** A moon: what the page turns into. Drawn in the button's text colour. */
function Moon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** A sun. */
function Sun() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The theme switch in the nav bar: a form whose action stores the choice in a cookie, as the language switch
 * does, so the server renders <html data-theme> from then on and no page ever paints in the wrong theme. Two
 * submit buttons, "switch to dark" and "switch to light"; theme.css shows only the one for the theme the page is
 * not in (whether that came from the cookie or from the system setting), so the server need not know the system
 * setting. A click also sets data-theme at once, so the page changes before the server answers.
 */
export function ThemeSwitch({ t }: { t: T }) {
  const choose = (theme: Theme) => () => { document.documentElement.setAttribute('data-theme', theme); };
  return (
    <form action={setTheme} className={styles.form}>
      <button
        type="submit" name="theme" value="dark" onClick={choose('dark')}
        className={`${styles.option} ${styles.toDark}`} aria-label={t('theme.toDark')} title={t('theme.toDark')}
      >
        <Moon />
      </button>
      <button
        type="submit" name="theme" value="light" onClick={choose('light')}
        className={`${styles.option} ${styles.toLight}`} aria-label={t('theme.toLight')} title={t('theme.toLight')}
      >
        <Sun />
      </button>
    </form>
  );
}
