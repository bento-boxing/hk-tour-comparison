'use client';

import { usePathname } from 'next/navigation';
import { useT } from '../lib/i18n-client';
import { splitLocalePath } from '../lib/locale-path';
import { NavBar, type NavPage } from './NavBar';

/**
 * The page a path shows, whatever its language ('/en/chain' is the chaining page). A destination's page
 * ('/tours/japan') is the search page with the destination chosen, so 搜尋旅行團 is current there; the index
 * ('/tours') is 所有目的地.
 */
export function pageFor(pathname: string): NavPage | undefined {
  const { path } = splitLocalePath(pathname);
  if (path === '/' || path.startsWith('/tours/')) return 'search';
  if (path === '/tours') return 'destinations';
  if (path === '/chain' || path.startsWith('/chain/')) return 'chain';
  return undefined;
}

/** The nav bar for the root layout, which cannot know the current path on the server. */
export function SiteNav() {
  return <NavBar current={pageFor(usePathname())} t={useT()} />;
}
