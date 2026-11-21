import { SearchPage, searchPageMetadata } from '../../_site/search-page';

// '/en?<filters>': the search page in English with a filter, the sort or the page, rendered per request. Not an
// address of its own: next.config.ts answers '/en' with this page when its query string carries any name in
// SEARCH_QUERY_NAMES, the visitor's address staying '/en?…' (lib/search-rewrites.ts); a visit straight to '/en/q' is
// sent to '/en'. The page without a filter is the stored copy, app/en/page.tsx.

export function generateMetadata({ searchParams }: PageProps<'/en/q'>) {
  return searchPageMetadata('en', searchParams);
}

export default function Page({ searchParams }: PageProps<'/en/q'>) {
  return <SearchPage locale="en" searchParams={searchParams} />;
}
