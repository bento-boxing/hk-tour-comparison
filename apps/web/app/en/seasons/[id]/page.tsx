import { SeasonPage, seasonPageMetadata } from '../../../_site/season-page';

// '/en/seasons/<id>': a season's page in English.

export function generateMetadata({ params, searchParams }: PageProps<'/en/seasons/[id]'>) {
  return seasonPageMetadata('en', params, searchParams);
}

export default function Page({ params, searchParams }: PageProps<'/en/seasons/[id]'>) {
  return <SeasonPage locale="en" params={params} searchParams={searchParams} />;
}
