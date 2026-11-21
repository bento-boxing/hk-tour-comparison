import { OperatorPage, operatorPageMetadata } from '../../../_site/operator-page';

// '/zh-hans/operators/<id>': an operator's page in Simplified Chinese.

export function generateMetadata({ params, searchParams }: PageProps<'/zh-hans/operators/[id]'>) {
  return operatorPageMetadata('zh-Hans', params, searchParams);
}

export default function Page({ params, searchParams }: PageProps<'/zh-hans/operators/[id]'>) {
  return <OperatorPage locale="zh-Hans" params={params} searchParams={searchParams} />;
}
