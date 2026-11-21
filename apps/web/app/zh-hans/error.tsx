'use client';

import { ErrorPage } from '../_site/error-page';

// The error page inside the Simplified Chinese pages, in their frame (see app/(zh-hant)/error.tsx).

export default function PageError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorPage locale="zh-Hans" retry={retry} />;
}
