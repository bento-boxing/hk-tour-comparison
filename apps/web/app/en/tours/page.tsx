import { ToursPage, toursPageMetadata } from '../../_site/tours-page';

// '/en/tours': the destinations index in English.

export function generateMetadata() {
  return toursPageMetadata('en');
}

export default function Page() {
  return <ToursPage locale="en" />;
}
