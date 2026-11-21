'use client';

import { ErrorPage } from '../_site/error-page';

// The error page inside the Traditional Chinese pages, in their frame: what a page shows when it could not be made
// (it threw), as when the database is down and /tours has no stored copy yet. An error boundary must be a client
// component. It does not cover the root layout itself, which reads nothing.

export default function PageError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorPage locale="zh-Hant" retry={retry} />;
}
