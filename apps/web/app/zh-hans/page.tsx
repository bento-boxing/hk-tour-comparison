import { SearchPage, searchPageMetadata } from '../_site/search-page';

// '/zh-hans': the search page in Simplified Chinese.

export function generateMetadata({ searchParams }: PageProps<'/zh-hans'>) {
  return searchPageMetadata('zh-Hans', searchParams);
}

export default function Page({ searchParams }: PageProps<'/zh-hans'>) {
  return <SearchPage locale="zh-Hans" searchParams={searchParams} />;
}
