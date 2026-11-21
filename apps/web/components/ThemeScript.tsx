'use client';

import { THEME_SCRIPT } from '../lib/theme';

/**
 * The theme script, for the <head> of each root layout (app/_site/site-frame.tsx) and of the 404 page
 * (app/global-not-found.tsx): the browser runs it as it reads the page, before the first paint, and it sets
 * <html data-theme> from the visitor's stored choice (lib/theme.ts). The <html> it changes carries
 * suppressHydrationWarning, as React and Next.js document for this (Next.js's "Preventing Flash" guide): React then
 * accepts the attributes it finds on that one element (not on anything inside it) instead of warning.
 *
 * A client component, as in that guide's "Extracting a reusable component": on the server the <script> has no type,
 * so the served HTML runs it; in the browser it is type="text/plain". Hydration keeps the served element as it is
 * (suppressHydrationWarning: the type differs on purpose). Where React builds the document in the browser instead
 * (a page that calls notFound() gets an empty shell from the server), it creates a text/plain script, which neither
 * runs nor makes React warn; the switch's keepThemeInStep (lib/theme-choice.ts) applies the theme there, before
 * paint.
 */
export function ThemeScript() {
  return (
    <script
      type={typeof window === 'undefined' ? undefined : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
