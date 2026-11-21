import { ToursPage, toursPageMetadata } from '../../_site/tours-page';

// '/en/tours': the destinations index in English.

/** A stored copy, made again at most once an hour (see app/(zh-hant)/tours/page.tsx). */
export const revalidate = 3600;

export function generateMetadata() {
  return toursPageMetadata('en');
}

export default function Page() {
  return <ToursPage locale="en" />;
}
