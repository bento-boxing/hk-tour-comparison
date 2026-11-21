import { SavedPage, savedPageMetadata } from '../../_site/saved-page';

// '/en/saved': the saved tours in English.

export function generateMetadata() {
  return savedPageMetadata('en');
}

export default function Page({ searchParams }: PageProps<'/en/saved'>) {
  return <SavedPage locale="en" searchParams={searchParams} />;
}
