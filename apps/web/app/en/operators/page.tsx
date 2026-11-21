import { OperatorsPage, operatorsPageMetadata } from '../../_site/operators-page';

// '/en/operators': the operators index in English.

/** A stored copy, made again at most once an hour (see app/(zh-hant)/tours/page.tsx). */
export const revalidate = 3600;

export function generateMetadata() {
  return operatorsPageMetadata('en');
}

export default function Page() {
  return <OperatorsPage locale="en" />;
}
