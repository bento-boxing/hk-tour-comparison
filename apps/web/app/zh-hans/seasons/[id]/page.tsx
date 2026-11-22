import { SeasonPage, seasonPageMetadata } from '../../../_site/season-page';

// '/zh-hans/seasons/<id>': a season's page in Simplified Chinese.

export function generateMetadata({ params, searchParams }: PageProps<'/zh-hans/seasons/[id]'>) {
  return seasonPageMetadata('zh-Hans', params, searchParams);
}

export default function Page({ params, searchParams }: PageProps<'/zh-hans/seasons/[id]'>) {
  return <SeasonPage locale="zh-Hans" params={params} searchParams={searchParams} />;
}
