import { ToursPage, toursPageMetadata } from '../../_site/tours-page';

// '/zh-hans/tours': the destinations index in Simplified Chinese.

/** A stored copy, made again at most once an hour (see app/(zh-hant)/tours/page.tsx). */
export const revalidate = 3600;

export function generateMetadata() {
  return toursPageMetadata('zh-Hans');
}

export default function Page() {
  return <ToursPage locale="zh-Hans" />;
}
