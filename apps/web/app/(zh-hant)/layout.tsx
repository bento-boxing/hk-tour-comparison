import type { ReactNode } from 'react';
import { SiteFrame, siteFrameMetadata } from '../_site/site-frame';

// The root layout of the Traditional Chinese addresses, which have no language prefix ('/', '/chain'). The
// route group's name is not part of the address. Simplified Chinese and English have their own root layouts
// (app/zh-hans, app/en); going from one root layout to another (only the language switch does) is a full
// page load.

export function generateMetadata() {
  return siteFrameMetadata('zh-Hant');
}

export default function Layout({ children }: { children: ReactNode }) {
  return <SiteFrame locale="zh-Hant">{children}</SiteFrame>;
}
