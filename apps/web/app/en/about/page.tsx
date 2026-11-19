import { AboutPage, aboutPageMetadata } from '../../_site/about-page';

// '/en/about': the about page in English.

export function generateMetadata() {
  return aboutPageMetadata('en');
}

export default function Page() {
  return <AboutPage locale="en" />;
}
