import { SearchPage, searchPageMetadata } from '../_site/search-page';

// '/zh-hans': the search page in Simplified Chinese.

export function generateMetadata() {
  return searchPageMetadata('zh-Hans');
}

export default function Page({ searchParams }: PageProps<'/zh-hans'>) {
  return <SearchPage locale="zh-Hans" searchParams={searchParams} />;
}
