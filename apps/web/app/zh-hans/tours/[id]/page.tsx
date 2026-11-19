import { DestinationPage, destinationPageMetadata } from '../../../_site/destination-page';

// '/zh-hans/tours/<id>': a destination's page in Simplified Chinese.

export function generateMetadata({ params, searchParams }: PageProps<'/zh-hans/tours/[id]'>) {
  return destinationPageMetadata('zh-Hans', params, searchParams);
}

export default function Page({ params, searchParams }: PageProps<'/zh-hans/tours/[id]'>) {
  return <DestinationPage locale="zh-Hans" params={params} searchParams={searchParams} />;
}
