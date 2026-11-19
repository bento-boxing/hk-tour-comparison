import { AboutPage, aboutPageMetadata } from '../../_site/about-page';

// '/zh-hans/about': the about page in Simplified Chinese.

export function generateMetadata() {
  return aboutPageMetadata('zh-Hans');
}

export default function Page() {
  return <AboutPage locale="zh-Hans" />;
}
