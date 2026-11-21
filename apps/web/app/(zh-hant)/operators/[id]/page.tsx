import { OperatorPage, operatorPageMetadata } from '../../../_site/operator-page';

// '/operators/<id>': an operator's page in Traditional Chinese.

export function generateMetadata({ params, searchParams }: PageProps<'/operators/[id]'>) {
  return operatorPageMetadata('zh-Hant', params, searchParams);
}

export default function Page({ params, searchParams }: PageProps<'/operators/[id]'>) {
  return <OperatorPage locale="zh-Hant" params={params} searchParams={searchParams} />;
}
