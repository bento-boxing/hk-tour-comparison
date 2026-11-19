import { SearchPage, searchPageMetadata } from '../_site/search-page';

// '/en': the search page in English.

export function generateMetadata({ searchParams }: PageProps<'/en'>) {
  return searchPageMetadata('en', searchParams);
}

export default function Page({ searchParams }: PageProps<'/en'>) {
  return <SearchPage locale="en" searchParams={searchParams} />;
}
