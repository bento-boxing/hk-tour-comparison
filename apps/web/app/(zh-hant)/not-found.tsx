import { NotFoundPage, notFoundMetadata } from '../_site/not-found-page';

// The 404 inside the Traditional Chinese pages, in their frame: what a page shows when it calls notFound() (an unknown
// '/tours/<id>'). An address no page answers gets app/global-not-found.tsx instead.

export const metadata = notFoundMetadata('zh-Hant');

export default function NotFound() {
  return <NotFoundPage locale="zh-Hant" />;
}
