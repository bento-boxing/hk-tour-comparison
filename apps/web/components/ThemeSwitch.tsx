'use client';

import { useLayoutEffect } from 'react';
import type { T } from '../lib/i18n';
import { keepThemeInStep, switchTheme } from '../lib/theme-choice';
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
 * The theme switch in the nav bar: one button, which turns the page to the other theme. A click (or Enter, or Space)
 * sets <html data-theme> at once and remembers the choice in this browser (lib/theme-choice.ts); the script in
 * <head> applies it on every later page before anything is drawn.
 *
 * The button has two faces, "switch to dark" (a moon) and "switch to light" (a sun), each its icon, its name as
 * text that is not drawn, and that name as its tooltip. theme.css shows only the face for the theme the page is not
 * in (whether chosen or from the system setting), so the server need not know the theme, the right icon and name are
 * there from the first paint, and the markup is the same in every theme (nothing for hydration to disagree on). The
 * button itself stays, so after a switch by keyboard the focus (and its ring) stays on it; only its face and name
 * change. With JavaScript off the switch is hidden (it could not work); the page then follows the system setting.
 */
export function ThemeSwitch({ t }: { t: T }) {
  // Before paint: the stored choice back on <html> should React's development remount clear it (Next.js's guide
  // says it can; not seen with React 19.3 and Next.js 16.4), then in step with the other tabs.
  useLayoutEffect(() => keepThemeInStep(), []);
  return (
    <div className={styles.switch}>
      <button type="button" onClick={() => switchTheme()} className={styles.option}>
        <span className={`${styles.face} ${styles.toDark}`} title={t('theme.toDark')}>
          <Moon /><span className={styles.label}>{t('theme.toDark')}</span>
        </span>
        <span className={`${styles.face} ${styles.toLight}`} title={t('theme.toLight')}>
          <Sun /><span className={styles.label}>{t('theme.toLight')}</span>
        </span>
      </button>
    </div>
  );
}
