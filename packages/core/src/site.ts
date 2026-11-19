/**
 * The site's public address and contact, in one place for the website (metadata, robots.txt, sitemap, footer)
 * and the scraper (its User-Agent). They live here, in core, because the scraper must not import the website.
 */

/** The site's address: https, no `www` (it redirects here), no trailing slash. */
export const SITE_URL = 'https://ganbintuen.com';

/** Where visitors and travel agencies write to. */
export const CONTACT_EMAIL = 'hello@ganbintuen.com';
