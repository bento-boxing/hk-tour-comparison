import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The workspace packages export TypeScript straight from src (no build step).
  transpilePackages: ['@hktours/core', '@hktours/db'],
  // Stop `next dev` from writing an AGENTS.md into the repo.
  agentRules: false,
  // Traditional Chinese has no language prefix ('/', '/chain'), so '/zh-hant/…' must not be a second copy of
  // its pages: a permanent (308) redirect to the same address without it. The query string is passed on
  // unchanged. These are routing rules, applied before any page is matched: no page code runs for them.
  async redirects() {
    return [
      { source: '/zh-hant', destination: '/', permanent: true },
      { source: '/zh-hant/:path+', destination: '/:path+', permanent: true },
    ];
  },
  experimental: {
    // Every language has its own root layout (app/(zh-hant), app/zh-hans, app/en), so there is no single
    // layout to put a 404 page in; app/global-not-found.tsx is the 404 page for any address no page answers.
    globalNotFound: true,
  },
};

export default nextConfig;
