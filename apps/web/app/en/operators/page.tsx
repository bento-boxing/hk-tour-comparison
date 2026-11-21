import { OperatorsPage, operatorsPageMetadata } from '../../_site/operators-page';

// '/en/operators': the operators index in English.

export function generateMetadata() {
  return operatorsPageMetadata('en');
}

export default function Page() {
  return <OperatorsPage locale="en" />;
}
