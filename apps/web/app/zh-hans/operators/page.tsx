import { OperatorsPage, operatorsPageMetadata } from '../../_site/operators-page';

// '/zh-hans/operators': the operators index in Simplified Chinese.

export function generateMetadata() {
  return operatorsPageMetadata('zh-Hans');
}

export default function Page() {
  return <OperatorsPage locale="zh-Hans" />;
}
