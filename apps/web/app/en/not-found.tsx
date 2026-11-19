import { NotFoundPage, notFoundMetadata } from '../_site/not-found-page';

// The 404 inside the English pages, in their frame: what a page shows when it calls notFound() (an unknown
// '/en/tours/<id>'). An address no page answers gets app/global-not-found.tsx instead.

export const metadata = notFoundMetadata('en');

export default function NotFound() {
  return <NotFoundPage locale="en" />;
}
