import Link from 'next/link';
import type { ComponentProps } from 'react';

/**
 * The site's internal link: next/link (a click still moves to the page without a full page load), but the page
 * is NOT pre-loaded by default. Next.js otherwise fetches every linked page in the background as soon as its link
 * scrolls into view; the site's pages are made per request, so each of those is a server render with database
 * reads (one visit to /tours, scrolled to the bottom, was 126 of them). prefetch={false} also stops the fetch on
 * hover. A link to a page that is stored (made at build time, like /about) may pass prefetch="auto", Next.js's own
 * default. Every other prop goes to next/link unchanged. The only file that imports next/link
 * (lib/next-link-guard.test.ts). Works in server and client components alike.
 */
export function SiteLink({ prefetch = false, ...props }: ComponentProps<typeof Link>) {
  return <Link prefetch={prefetch} {...props} />;
}
