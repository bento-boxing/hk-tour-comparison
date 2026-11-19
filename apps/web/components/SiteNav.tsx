'use client';

import { usePathname } from 'next/navigation';
import { useT } from '../lib/i18n-client';
import { splitLocalePath } from '../lib/locale-path';
import { NavBar, type NavPage } from './NavBar';

/** The page a path shows, whatever its language ('/en/chain' is the chaining page). */
function pageFor(pathname: string): NavPage | undefined {
  const { path } = splitLocalePath(pathname);
  if (path === '/') return 'search';
  if (path === '/chain' || path.startsWith('/chain/')) return 'chain';
  return undefined;
}

/** The nav bar for the root layout, which cannot know the current path on the server. */
export function SiteNav() {
  return <NavBar current={pageFor(usePathname())} t={useT()} />;
}
