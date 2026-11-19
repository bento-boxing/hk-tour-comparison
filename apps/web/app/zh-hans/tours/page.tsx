import { ToursPage, toursPageMetadata } from '../../_site/tours-page';

// '/zh-hans/tours': the destinations index in Simplified Chinese.

export function generateMetadata() {
  return toursPageMetadata('zh-Hans');
}

export default function Page() {
  return <ToursPage locale="zh-Hans" />;
}
