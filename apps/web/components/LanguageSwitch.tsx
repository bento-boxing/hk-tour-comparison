'use client';

import { HTML_LANG, LOCALES, type Locale, type T } from '../lib/i18n';
import { setLocale } from '../lib/locale-action';
import styles from './LanguageSwitch.module.css';

/** Each language named in itself, whatever the current one; the short form is for narrow screens. */
export const LANGUAGE_NAMES: Record<Locale, { name: string; short: string }> = {
  'zh-Hant': { name: '繁體中文', short: '繁' },
  'zh-Hans': { name: '简体中文', short: '简' },
  en: { name: 'English', short: 'EN' },
};

/**
 * The language switch in the nav bar: one submit button per language in a form whose action stores the
 * choice in a cookie. Next.js then re-renders the same page (same address, no scroll) in the new language;
 * before the page's JavaScript has loaded, the form posts to the same address and the browser shows the
 * re-rendered page. The current language is marked aria-pressed.
 */
export function LanguageSwitch({ t }: { t: T }) {
  return (
    <form action={setLocale} className={styles.form}>
      <div role="group" aria-label={t('lang.label')} className={styles.group}>
        {LOCALES.map(locale => {
          const { name, short } = LANGUAGE_NAMES[locale];
          return (
            <button
              key={locale}
              type="submit"
              name="locale"
              value={locale}
              lang={HTML_LANG[locale]}
              aria-label={name}
              aria-pressed={locale === t.locale}
              className={styles.option}
            >
              <span className={styles.long}>{name}</span>
              <span className={styles.short} aria-hidden="true">{short}</span>
            </button>
          );
        })}
      </div>
    </form>
  );
}
