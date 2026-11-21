import { SearchPage, searchPageMetadata } from '../../_site/search-page';

// '/?<filters>' in Traditional Chinese: the search page with a filter, the sort or the page, rendered per request. Not
// an address of its own: next.config.ts answers '/' with this page when its query string carries any name in
// SEARCH_QUERY_NAMES, the visitor's address staying '/?…' (lib/search-rewrites.ts); a visit straight to '/q' is sent
// to '/'. The page without a filter is the stored copy, app/(zh-hant)/page.tsx.

export function generateMetadata({ searchParams }: PageProps<'/q'>) {
  return searchPageMetadata('zh-Hant', searchParams);
}

export default function Page({ searchParams }: PageProps<'/q'>) {
  return <SearchPage locale="zh-Hant" searchParams={searchParams} />;
}
