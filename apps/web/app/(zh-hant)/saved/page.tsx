import { SavedPage, savedPageMetadata } from '../../_site/saved-page';

// '/saved': the saved tours in Traditional Chinese.

export function generateMetadata() {
  return savedPageMetadata('zh-Hant');
}

export default function Page({ searchParams }: PageProps<'/saved'>) {
  return <SavedPage locale="zh-Hant" searchParams={searchParams} />;
}
