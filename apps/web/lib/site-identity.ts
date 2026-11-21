import { resolveSiteIdentity, type SiteIdentity } from '@hktours/core';

// The site's address and contact on the server: SITE_URL and CONTACT_EMAIL, checked by core's
// resolveSiteIdentity (the scraper's User-Agent uses the same). Server code only: never NEXT_PUBLIC_, so neither
// value is put into the browser's scripts; a client component that needs the contact is given it as a prop.
//
// next.config.ts checks the same two variables when `next build`, `next dev` or `next start` starts, and stops
// there without them, so a deployment never goes out without an identity. Here they are read once per server
// process, on the first call, and that result is kept: a request never pays for checking them again.
//
// When it is called:
//   - static routes (/robots.txt, and the pages that read no data) at build time, so their output carries the
//     values the build had;
//   - stored pages (/tours and /operators, which read the database through storedDb) at build time, and again
//     whenever their stored copy is remade (at most once an hour), with the values of the process that remakes it
//     (on Vercel the same variables as the build's);
//   - dynamic routes (the other pages that read the database, through requestDb's connection(), and /sitemap.xml)
//     on each request, from the kept result.

let resolved: SiteIdentity | undefined;

/** The site's identity from process.env, checked on the first call in this process and kept. Throws when it is missing or malformed. */
export function siteIdentity(): SiteIdentity {
  resolved ??= resolveSiteIdentity(process.env);
  return resolved;
}
