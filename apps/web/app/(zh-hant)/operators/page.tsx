import { OperatorsPage, operatorsPageMetadata } from '../../_site/operators-page';

// '/operators': the operators index in Traditional Chinese.

export function generateMetadata() {
  return operatorsPageMetadata('zh-Hant');
}

export default function Page() {
  return <OperatorsPage locale="zh-Hant" />;
}
