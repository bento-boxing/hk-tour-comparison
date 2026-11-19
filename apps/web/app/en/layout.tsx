import type { ReactNode } from 'react';
import { SiteFrame, siteFrameMetadata } from '../_site/site-frame';

// The root layout of the English addresses ('/en', '/en/chain'). A plain folder, not a [lang] segment, so no
// other first segment ('/fr', '/EN') can reach a page: it is unmatched, a 404.

export function generateMetadata() {
  return siteFrameMetadata('en');
}

export default function Layout({ children }: { children: ReactNode }) {
  return <SiteFrame locale="en">{children}</SiteFrame>;
}
