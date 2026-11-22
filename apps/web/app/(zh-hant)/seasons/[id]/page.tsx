import { SeasonPage, seasonPageMetadata } from '../../../_site/season-page';

// '/seasons/<id>': a season's page in Traditional Chinese.

export function generateMetadata({ params, searchParams }: PageProps<'/seasons/[id]'>) {
  return seasonPageMetadata('zh-Hant', params, searchParams);
}

export default function Page({ params, searchParams }: PageProps<'/seasons/[id]'>) {
  return <SeasonPage locale="zh-Hant" params={params} searchParams={searchParams} />;
}
