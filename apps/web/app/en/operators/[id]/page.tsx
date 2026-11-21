import { OperatorPage, operatorPageMetadata } from '../../../_site/operator-page';

// '/en/operators/<id>': an operator's page in English.

export function generateMetadata({ params, searchParams }: PageProps<'/en/operators/[id]'>) {
  return operatorPageMetadata('en', params, searchParams);
}

export default function Page({ params, searchParams }: PageProps<'/en/operators/[id]'>) {
  return <OperatorPage locale="en" params={params} searchParams={searchParams} />;
}
