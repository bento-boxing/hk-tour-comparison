import { DestinationPage, destinationPageMetadata } from '../../../_site/destination-page';

// '/tours/<id>': a destination's page in Traditional Chinese.

export function generateMetadata({ params, searchParams }: PageProps<'/tours/[id]'>) {
  return destinationPageMetadata('zh-Hant', params, searchParams);
}

export default function Page({ params, searchParams }: PageProps<'/tours/[id]'>) {
  return <DestinationPage locale="zh-Hant" params={params} searchParams={searchParams} />;
}
