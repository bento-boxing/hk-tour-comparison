import { SearchPage, searchPageMetadata } from '../_site/search-page';

// '/en': the search page in English.

export function generateMetadata() {
  return searchPageMetadata('en');
}

export default function Page({ searchParams }: PageProps<'/en'>) {
  return <SearchPage locale="en" searchParams={searchParams} />;
}
