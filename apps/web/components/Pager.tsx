import { SiteLink } from './SiteLink';
import type { T } from '../lib/i18n';
import { localeHref } from '../lib/locale-path';
import { pageSizeOf, searchHref, type SearchState } from '../lib/search-params';
import styles from './Pager.module.css';

/** A state's address without a language: the search page's (searchHref) unless the page gives its own. */
export type StateHref = (state: SearchState) => string;

/**
 * The page numbers to show around `page` of `pages`: the first, the last, and the current one with its neighbours;
 * null where numbers are left out ('…'). [1, 2, 3, null, 89] on page 2 of 89.
 */
export function pageNumbers(page: number, pages: number): (number | null)[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  return shown.flatMap((n, i) => (i > 0 && n - shown[i - 1] > 1 ? [null, n] : [n]));
}

/**
 * ‹ 上一頁 / 1 2 3 … 89 / 下一頁 › as real links, so paging works without JavaScript; on a phone the numbers give
 * way to 第 n / m 頁. Nothing when every match fits on one page; a page beyond the last offers a link back to page 1
 * instead. The rows per page come from the state.
 */
export function Pager({ state, total, t, hrefFor = searchHref }: {
  state: SearchState; total: number; t: T;
  /** The address of a state (another page), without the language (the pager adds `t`'s). The chain page keeps its chain. */
  hrefFor?: StateHref;
}) {
  if (total === 0) return null; // the empty state already links to a fresh search
  const pages = Math.ceil(total / pageSizeOf(state));
  const at = (page: number): SearchState => ({ ...state, page });

  if (state.page > pages) {
    return (
      <nav className={styles.pager} aria-label={t('pager.label')}>
        <SiteLink className={styles.step} href={localeHref(t.locale, hrefFor(at(1)))}>{t('pager.first')}</SiteLink>
      </nav>
    );
  }
  if (pages === 1) return null;

  return (
    <nav className={styles.pager} aria-label={t('pager.label')}>
      {state.page > 1 && (
        <SiteLink className={styles.step} rel="prev" href={localeHref(t.locale, hrefFor(at(state.page - 1)))}><span aria-hidden="true">{'‹\u00a0'}</span>{t('pager.prev')}</SiteLink>
      )}
      <ul className={styles.numbers}>
        {pageNumbers(state.page, pages).map((n, i) => (n === null ? (
          <li key={`gap-${i}`} className={styles.gap} aria-hidden="true">…</li>
        ) : (
          <li key={n}>
            <SiteLink
              className={styles.number} href={localeHref(t.locale, hrefFor(at(n)))} aria-label={t('pager.goTo', { page: n })}
              aria-current={n === state.page ? 'page' : undefined}
            >
              {n}
            </SiteLink>
          </li>
        )))}
      </ul>
      {/* Shown instead of the numbers on a phone (CSS hides one or the other, for every reader alike). */}
      <span className={styles.where}>{t('pager.page', { page: state.page, pages })}</span>
      {state.page < pages && (
        <SiteLink className={styles.step} rel="next" href={localeHref(t.locale, hrefFor(at(state.page + 1)))}>{t('pager.next')}<span aria-hidden="true">{'\u00a0›'}</span></SiteLink>
      )}
    </nav>
  );
}
