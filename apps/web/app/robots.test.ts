import { it, expect } from 'vitest';
// Next.js's own step that turns robots()'s object into the served text, so the text below is what /robots.txt serves.
// It is an internal module: if this import breaks after a Next.js upgrade, check the served /robots.txt by hand and
// update or delete the text test; the object test above it is the real guard.
import { resolveRouteData } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data';
import robots from './robots';

// robots-parser (the scraper's dependency) cannot be resolved from the website's tests and is not added here, so
// these tests pin the rules and the served text. What a longest-match reader (Google, Bing) makes of that text is
// shown against the built site in the task 42 fix reports.

it('every crawler may read every page except an address with a query string, but may fetch the icons and the static files, and is pointed at the sitemap', () => {
  expect(robots()).toEqual({
    rules: { userAgent: '*', allow: ['/_next/static/', '/icon.svg?', '/apple-icon.png?'], disallow: '/*?' },
    sitemap: 'https://example.invalid/sitemap.xml',
  });
});

it('the icon rules name the files and the start of a query string only, nothing from Next.js\'s hashed suffix', () => {
  const { rules } = robots();
  const allow = Array.isArray(rules) ? [] : [rules.allow ?? []].flat();
  const iconRules = allow.filter(rule => rule !== '/_next/static/');
  expect(iconRules).toHaveLength(2);
  for (const rule of iconRules) expect(rule).toMatch(/^\/[a-z-]+\.(svg|png)\?$/);
});

it('the static files (styles, scripts) are allowed by a prefix, so a query string on their address can never block them', () => {
  const { rules } = robots();
  const allow = Array.isArray(rules) ? [] : [rules.allow ?? []].flat();
  expect(allow).toContain('/_next/static/');
  // Longer than the Disallow, so it wins under the longest-match rule Google and Bing follow.
  expect('/_next/static/'.length).toBeGreaterThan('/*?'.length);
});

it('/robots.txt reads exactly so: the Allow lines, then the Disallow, and no Allow: / a first-match reader could take over it', () => {
  expect(resolveRouteData(robots(), 'robots')).toBe(
    'User-Agent: *\n' +
    'Allow: /_next/static/\n' +
    'Allow: /icon.svg?\n' +
    'Allow: /apple-icon.png?\n' +
    'Disallow: /*?\n' +
    '\n' +
    'Sitemap: https://example.invalid/sitemap.xml\n',
  );
});
