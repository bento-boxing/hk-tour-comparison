import { ChainPage, chainPageMetadata } from '../../_site/chain-page';

// '/chain': the chaining page in Traditional Chinese.

export function generateMetadata({ searchParams }: PageProps<'/chain'>) {
  return chainPageMetadata('zh-Hant', searchParams);
}

export default function Page({ searchParams }: PageProps<'/chain'>) {
  return <ChainPage locale="zh-Hant" searchParams={searchParams} />;
}
