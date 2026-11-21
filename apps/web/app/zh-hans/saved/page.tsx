import { SavedPage, savedPageMetadata } from '../../_site/saved-page';

// '/zh-hans/saved': the saved tours in Simplified Chinese.

export function generateMetadata() {
  return savedPageMetadata('zh-Hans');
}

export default function Page({ searchParams }: PageProps<'/zh-hans/saved'>) {
  return <SavedPage locale="zh-Hans" searchParams={searchParams} />;
}
