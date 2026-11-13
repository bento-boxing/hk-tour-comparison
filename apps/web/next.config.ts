import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The workspace packages export TypeScript straight from src (no build step).
  transpilePackages: ['@hktours/core', '@hktours/db'],
  // Stop `next dev` from writing an AGENTS.md into the repo.
  agentRules: false,
};

export default nextConfig;
