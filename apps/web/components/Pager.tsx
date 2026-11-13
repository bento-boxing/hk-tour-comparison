import Link from 'next/link';
import { PAGE_SIZE } from '@hktours/db/read';
import type { T } from '../lib/i18n';
import { searchHref, type SearchState } from '../lib/search-params';
import styles from './Pager.module.css';

/**
 * 上一頁 / 第 n / m 頁 / 下一頁 as real links, so paging works without JavaScript. Nothing when every match
 * fits on one page; a page beyond the last offers a link back to page 1 instead.
 */
export function Pager({ state, total, t }: { state: SearchState; total: number; t: T }) {
  if (total === 0) return null; // the empty state already links to a fresh search
  const pages = Math.ceil(total / PAGE_SIZE);
  const href = (page: number) => searchHref({ ...state, page });

  if (state.page > pages) {
    return (
      <nav className={styles.pager} aria-label={t('pager.label')}>
        <Link className={styles.link} href={href(1)}>{t('pager.first')}</Link>
      </nav>
    );
  }
  if (pages === 1) return null;

  return (
    <nav className={styles.pager} aria-label={t('pager.label')}>
      {state.page > 1 && <Link className={styles.link} rel="prev" href={href(state.page - 1)}>{t('pager.prev')}</Link>}
      <span className={styles.page}>{t('pager.page', { page: state.page, pages })}</span>
      {state.page < pages && <Link className={styles.link} rel="next" href={href(state.page + 1)}>{t('pager.next')}</Link>}
    </nav>
  );
}
