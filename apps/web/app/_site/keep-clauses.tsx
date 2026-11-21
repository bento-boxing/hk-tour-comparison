import { Fragment } from 'react';
import type { Locale } from '../../lib/i18n';
import styles from './keep-clauses.module.css';

/**
 * A short sentence of two or more clauses ('本頁並非X的網站，本網站與X並無任何關連。') that wraps only between its
 * clauses in Chinese: each clause (with its comma) is kept on one line, and a line may break after a comma. Chinese
 * may otherwise break between any two characters, which can leave two or three of them alone on the last line.
 * English wraps between words as usual. Each clause must fit the narrowest screen (the operator pages' longest is
 * measured at 320px).
 */
export function KeepClauses({ text, locale }: { text: string; locale: Locale }) {
  if (locale === 'en') return <>{text}</>;
  return (
    <>
      {text.split(/(?<=，)/).map((clause, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          <span className={styles.clause}>{clause}</span>
        </Fragment>
      ))}
    </>
  );
}
