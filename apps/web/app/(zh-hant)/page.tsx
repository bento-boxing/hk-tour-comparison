import { StoredSearchPage, storedSearchPageMetadata } from '../_site/search-page';

// '/': the search page in Traditional Chinese, without a filter. An address with one ('/?dmin=5': any name in
// SEARCH_QUERY_NAMES) is answered by app/(zh-hant)/q/page.tsx instead (lib/search-rewrites.ts, next.config.ts).

/**
 * A stored copy: made when the site is built, then made again at most once an hour (on the first visit after the
 * hour; that visitor still gets the stored one). It reads nothing from the request. Next.js needs the number written
 * here, not imported.
 */
export const revalidate = 3600;

export function generateMetadata() {
  return storedSearchPageMetadata('zh-Hant');
}

export default function Page() {
  return <StoredSearchPage locale="zh-Hant" />;
}
