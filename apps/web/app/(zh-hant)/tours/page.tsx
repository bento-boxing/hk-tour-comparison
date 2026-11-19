import { ToursPage, toursPageMetadata } from '../../_site/tours-page';

// '/tours': the destinations index in Traditional Chinese.

export function generateMetadata() {
  return toursPageMetadata('zh-Hant');
}

export default function Page() {
  return <ToursPage locale="zh-Hant" />;
}
