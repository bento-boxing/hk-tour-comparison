import { ChainPage, chainPageMetadata } from '../../_site/chain-page';

// '/zh-hans/chain': the chaining page in Simplified Chinese.

export function generateMetadata({ searchParams }: PageProps<'/zh-hans/chain'>) {
  return chainPageMetadata('zh-Hans', searchParams);
}

export default function Page({ searchParams }: PageProps<'/zh-hans/chain'>) {
  return <ChainPage locale="zh-Hans" searchParams={searchParams} />;
}
