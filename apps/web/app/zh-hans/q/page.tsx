import { SearchPage, searchPageMetadata } from '../../_site/search-page';

// '/zh-hans?<filters>': the search page in Simplified Chinese with a filter, the sort or the page, rendered per
// request. Not an address of its own: next.config.ts answers '/zh-hans' with this page when its query string carries
// any name in SEARCH_QUERY_NAMES, the visitor's address staying '/zh-hans?…' (lib/search-rewrites.ts); a visit
// straight to '/zh-hans/q' is sent to '/zh-hans'. The page without a filter is the stored copy, app/zh-hans/page.tsx.

export function generateMetadata({ searchParams }: PageProps<'/zh-hans/q'>) {
  return searchPageMetadata('zh-Hans', searchParams);
}

export default function Page({ searchParams }: PageProps<'/zh-hans/q'>) {
  return <SearchPage locale="zh-Hans" searchParams={searchParams} />;
}
