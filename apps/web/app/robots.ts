import type { MetadataRoute } from 'next';
import { siteIdentity } from '../lib/site-identity';

/**
 * /robots.txt: every crawler may read every page except an address with a query string (`/*?`). A filtered,
 * sorted or paged address is the same page as its canonical one (lib/site-metadata.ts), and on Vercel's free
 * plan each would be a function run and possibly a database read: the pages with filters are rendered per request.
 * (The stored pages, /tours and /operators, read no query string, so crawlers lose nothing there.)
 *
 * The exception: Next.js links the icons (app/icon.svg, app/apple-icon.png) with a query string
 * (`/icon.svg?icon.<hash>.svg`), and Google fetches the favicon only if robots.txt allows it. Google and Bing
 * follow the longest matching rule, so `Allow: /icon.svg?` wins over `Disallow: /*?` for those files alone. The
 * rules stop at the `?`: nothing depends on the hash, which changes with the file.
 *
 * `Allow: /_next/static/` keeps the styles and scripts fetchable even if their addresses ever carry a query string
 * (Vercel's Skew Protection adds `?dpl=…`): a crawler that cannot fetch them renders the page unstyled. Static
 * files cost no function run.
 *
 * There is deliberately no `Allow: /` line: Next.js writes Allow lines before the Disallow, and a reader that
 * takes the first matching line would then allow everything.
 *
 * A static route: built once, at build time, with the SITE_URL the build had.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: ['/_next/static/', '/icon.svg?', '/apple-icon.png?'], disallow: '/*?' },
    sitemap: `${siteIdentity().siteUrl}/sitemap.xml`,
  };
}
