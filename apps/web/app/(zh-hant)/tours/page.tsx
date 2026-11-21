import { ToursPage, toursPageMetadata } from '../../_site/tours-page';

// '/tours': the destinations index in Traditional Chinese.

/**
 * A stored copy: made when the site is built, then made again at most once an hour (on the first visit after the
 * hour; that visitor still gets the stored one). Next.js needs the number written here, not imported.
 */
export const revalidate = 3600;

export function generateMetadata() {
  return toursPageMetadata('zh-Hant');
}

export default function Page() {
  return <ToursPage locale="zh-Hant" />;
}
