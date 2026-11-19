import { ChainPage, chainPageMetadata } from '../../_site/chain-page';

// '/en/chain': the chaining page in English.

export function generateMetadata({ searchParams }: PageProps<'/en/chain'>) {
  return chainPageMetadata('en', searchParams);
}

export default function Page({ searchParams }: PageProps<'/en/chain'>) {
  return <ChainPage locale="en" searchParams={searchParams} />;
}
