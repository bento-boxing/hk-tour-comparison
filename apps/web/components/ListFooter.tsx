import Link from 'next/link';
import { PAGE_SIZES } from '@hktours/core';
import type { T } from '../lib/i18n';
import { localeHref } from '../lib/locale-path';
import { formatCount } from '../lib/format';
import { lastUpdateDay } from '../lib/card-text';
import { pageSizeOf, searchHref, withPageSize, type SearchState } from '../lib/search-params';
import { Pager, type StateHref } from './Pager';
import styles from './ListFooter.module.css';

/**
 * Under the list (mock-up Rows): the rows-per-page choice (24, 48, 96, as links that keep every other setting in the
 * address, so it works without JavaScript), which rows these are ('第 1–24 個，共 2,122 個旅行團', announced when a
 * filter changes it), and the pager. Nothing when there are no matches (the empty state has its own link); only the
 * pager's way back to page 1 on a page past the last. The choice shows only when there are more matches than the
 * smallest page holds.
 */
export function ListFooter({ state, total, t, hrefFor = searchHref }: {
  state: SearchState; total: number; t: T;
  /** The address of a state, without the language: the search page's by default; the chain page keeps its chain. */
  hrefFor?: StateHref;
}) {
  if (total === 0) return null;
  const size = pageSizeOf(state);
  const from = (state.page - 1) * size + 1;
  if (from > total) return <div className={styles.footer}><Pager state={state} total={total} t={t} hrefFor={hrefFor} /></div>;
  const to = Math.min(state.page * size, total);

  return (
    <div className={styles.footer}>
      {total > PAGE_SIZES[0] && (
        <div className={styles.size}>
          <span id="rows-per-page" className={styles.sizeLabel}>{t('pager.size')}</span>
          <div role="group" aria-labelledby="rows-per-page" className={styles.sizes}>
            {PAGE_SIZES.map(n => (
              <Link
                key={n} className={styles.sizeOption} aria-current={n === size ? 'true' : undefined}
                href={localeHref(t.locale, hrefFor(withPageSize(state, n, total)))}
              >
                {n}
              </Link>
            ))}
          </div>
        </div>
      )}
      <p className={styles.range} aria-live="polite">
        {t('pager.range', { from: formatCount(from), to: formatCount(to), total: formatCount(total) })}
      </p>
      <Pager state={state} total={total} t={t} hrefFor={hrefFor} />
    </div>
  );
}

/**
 * Under the list, one line: when the data was last updated (the latest good run of any operator, as a day), that each
 * operator's data is read once a night, and that the operators' websites take precedence. A row whose operator's data
 * is older says so itself (TourCard). Nothing when no operator has had a good run.
 */
export function UpdatedNote({ operators, t }: { operators: { lastGoodRunAt: string | null }[]; t: T }) {
  const date = lastUpdateDay(operators, t);
  // Each " · " keeps its dot with the words before it (a no-break space), so a wrapped line never starts with "·".
  return date === null ? null : <p className={styles.updated}>{t('list.updated', { date }).replaceAll(' · ', '\u00a0· ')}</p>;
}
