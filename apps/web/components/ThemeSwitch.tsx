'use client';

import { useLayoutEffect } from 'react';
import type { T } from '../lib/i18n';
import { chooseTheme, keepThemeInStep } from '../lib/theme-choice';
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
 * The theme switch in the nav bar: two buttons, "switch to dark" and "switch to light". A click sets
 * <html data-theme> at once and remembers the choice in this browser (lib/theme-choice.ts); the script in <head>
 * applies it on every later page before anything is drawn. theme.css shows only the button for the theme the page
 * is not in (whether chosen or from the system setting), so the server need not know the theme and the right icon
 * is drawn from the first paint. With JavaScript off the switch is hidden (it could not work); the page then
 * follows the system setting.
 */
export function ThemeSwitch({ t }: { t: T }) {
  // Before paint: the stored choice back on <html> should React's development remount clear it (Next.js's guide
  // says it can; not seen with React 19.3 and Next.js 16.4), then in step with the other tabs.
  useLayoutEffect(() => keepThemeInStep(), []);
  return (
    <div className={styles.switch}>
      <button
        type="button" onClick={() => chooseTheme('dark')}
        className={`${styles.option} ${styles.toDark}`} aria-label={t('theme.toDark')} title={t('theme.toDark')}
      >
        <Moon />
      </button>
      <button
        type="button" onClick={() => chooseTheme('light')}
        className={`${styles.option} ${styles.toLight}`} aria-label={t('theme.toLight')} title={t('theme.toLight')}
      >
        <Sun />
      </button>
    </div>
  );
}
