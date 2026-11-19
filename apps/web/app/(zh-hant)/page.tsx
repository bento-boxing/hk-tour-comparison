import { SearchPage, searchPageMetadata } from '../_site/search-page';

// '/': the search page in Traditional Chinese.

export function generateMetadata() {
  return searchPageMetadata('zh-Hant');
}

export default function Page({ searchParams }: PageProps<'/'>) {
  return <SearchPage locale="zh-Hant" searchParams={searchParams} />;
}
