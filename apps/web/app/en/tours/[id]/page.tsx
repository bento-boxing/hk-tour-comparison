import { DestinationPage, destinationPageMetadata } from '../../../_site/destination-page';

// '/en/tours/<id>': a destination's page in English.

export function generateMetadata({ params, searchParams }: PageProps<'/en/tours/[id]'>) {
  return destinationPageMetadata('en', params, searchParams);
}

export default function Page({ params, searchParams }: PageProps<'/en/tours/[id]'>) {
  return <DestinationPage locale="en" params={params} searchParams={searchParams} />;
}
