import { OperatorsPage, operatorsPageMetadata } from '../../_site/operators-page';

// '/operators': the operators index in Traditional Chinese.

/** A stored copy, made again at most once an hour (see app/(zh-hant)/tours/page.tsx). */
export const revalidate = 3600;

export function generateMetadata() {
  return operatorsPageMetadata('zh-Hant');
}

export default function Page() {
  return <OperatorsPage locale="zh-Hant" />;
}
