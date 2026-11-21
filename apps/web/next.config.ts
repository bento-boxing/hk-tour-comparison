import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from 'next/constants';
import { resolveSiteIdentity } from '@hktours/core';
import { checkBuildWithoutDatabase } from './lib/build-without-database';
import { perRequestRedirects, storedSearchRewrites } from './lib/search-rewrites';

/** The settings themselves; Next.js reads them through the function below. */
export const nextConfig: NextConfig = {
  // The workspace packages export TypeScript straight from src (no build step).
  transpilePackages: ['@hktours/core', '@hktours/db'],
  // Stop `next dev` from writing an AGENTS.md into the repo.
  agentRules: false,
  // Traditional Chinese has no language prefix ('/', '/chain'), so '/zh-hant/…' must not be a second copy of
  // its pages: a permanent (308) redirect to the same address without it. The query string is passed on
  // unchanged. These are routing rules, applied before any page is matched: no page code runs for them.
  // A visit straight to a stored page's per-request copy (its internal address, '/q') goes to the page's own address:
  // lib/search-rewrites.ts.
  async redirects() {
    return [
      { source: '/zh-hant', destination: '/', permanent: true },
      { source: '/zh-hant/:path+', destination: '/:path+', permanent: true },
      ...perRequestRedirects(),
    ];
  },
  // The home page is a stored copy that reads no query string: an address of it carrying a filter, the sort or the
  // page ('/?dmin=5') is answered by its per-request copy ('/q?dmin=5'), unseen by the visitor. `beforeFiles`, so the
  // rules apply although a page (the stored copy) answers the address. Made from the list of the names the search
  // pages read (lib/search-params.ts SEARCH_QUERY_NAMES); see lib/search-rewrites.ts. Routing rules: no page code runs.
  async rewrites() {
    return { beforeFiles: storedSearchRewrites(), afterFiles: [], fallback: [] };
  },
  experimental: {
    // Every language has its own root layout (app/(zh-hant), app/zh-hans, app/en), so there is no single
    // layout to put a 404 page in; app/global-not-found.tsx is the 404 page for any address no page answers.
    globalNotFound: true,
  },
};

/**
 * The site's address and contact (SITE_URL, CONTACT_EMAIL; see lib/site-identity.ts) are checked here, before
 * anything is built or served: `next build`, `next dev` and `next start` stop with core's one-line message when
 * either is missing or malformed. Next.js has loaded .env.local (and the other .env files) before this runs. On
 * Vercel a failed build leaves the previous deployment live, so a deployment never goes out without them.
 *
 * A build also stops when BUILD_WITHOUT_DATABASE=1 is set on Vercel (lib/build-without-database.ts): that setting
 * is for CI and local builds only.
 *
 * Not for `next typegen` (pnpm typecheck), which only writes route types: it loads this file with the build's
 * phase, so it is told apart by its command.
 */
export default function config(phase: string): NextConfig {
  const runsTheSite = [PHASE_PRODUCTION_BUILD, PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER].includes(phase);
  if (runsTheSite && !process.argv.includes('typegen')) {
    resolveSiteIdentity(process.env);
    if (phase === PHASE_PRODUCTION_BUILD) checkBuildWithoutDatabase(process.env);
  }
  return nextConfig;
}
