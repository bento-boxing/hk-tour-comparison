import { ChainPage, chainPageMetadata } from '../../_site/chain-page';

// '/chain': the chaining page in Traditional Chinese.

export function generateMetadata() {
  return chainPageMetadata('zh-Hant');
}

export default function Page({ searchParams }: PageProps<'/chain'>) {
  return <ChainPage locale="zh-Hant" searchParams={searchParams} />;
}
