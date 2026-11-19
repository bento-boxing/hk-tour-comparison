import { AboutPage, aboutPageMetadata } from '../../_site/about-page';

// '/about': the about page in Traditional Chinese.

export function generateMetadata() {
  return aboutPageMetadata('zh-Hant');
}

export default function Page() {
  return <AboutPage locale="zh-Hant" />;
}
