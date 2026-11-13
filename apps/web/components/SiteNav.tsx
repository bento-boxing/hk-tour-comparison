'use client';

import { usePathname } from 'next/navigation';
import { useT } from '../lib/i18n-client';
import { NavBar, type NavPage } from './NavBar';

function pageFor(pathname: string): NavPage | undefined {
  if (pathname === '/') return 'search';
  if (pathname === '/chain' || pathname.startsWith('/chain/')) return 'chain';
  return undefined;
}

/** The nav bar for the root layout, which cannot know the current path on the server. */
export function SiteNav() {
  return <NavBar current={pageFor(usePathname())} t={useT()} />;
}
