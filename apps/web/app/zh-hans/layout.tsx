import type { ReactNode } from 'react';
import { SiteFrame, siteFrameMetadata } from '../_site/site-frame';

// The root layout of the Simplified Chinese addresses ('/zh-hans', '/zh-hans/chain'). A plain folder, not a
// [lang] segment, so no other first segment ('/fr', '/zh-Hans') can reach a page: it is unmatched, a 404.

export function generateMetadata() {
  return siteFrameMetadata('zh-Hans');
}

export default function Layout({ children }: { children: ReactNode }) {
  return <SiteFrame locale="zh-Hans">{children}</SiteFrame>;
}
