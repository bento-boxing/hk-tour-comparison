// @vitest-environment node
import { it, expect, vi, afterEach } from 'vitest';
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from 'next/constants';
import { buildsWithoutDatabase, checkBuildWithoutDatabase } from './build-without-database';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it.each([['1', true], ['', false], ['0', false], ['true', false], [' 1', false], [undefined, false]] as const)(
  'BUILD_WITHOUT_DATABASE=%j counts: %s (only 1, exactly)', (value, expected) => {
    expect(buildsWithoutDatabase({ BUILD_WITHOUT_DATABASE: value })).toBe(expected);
  });

it('is refused on Vercel (VERCEL set), with a message naming the setting and where it belongs', () => {
  expect(() => checkBuildWithoutDatabase({ BUILD_WITHOUT_DATABASE: '1', VERCEL: '1' })).toThrow(
    /^BUILD_WITHOUT_DATABASE=1 is for CI and local builds only, and this build runs on Vercel \(VERCEL is set\)\. Remove it from the Vercel project's environment variables: /,
  );
});

it.each([
  [{ BUILD_WITHOUT_DATABASE: '1' }],
  [{ VERCEL: '1' }],
  [{ BUILD_WITHOUT_DATABASE: '0', VERCEL: '1' }],
  [{ BUILD_WITHOUT_DATABASE: '1', VERCEL: '' }],
  [{}],
])('is allowed otherwise: %j', env => {
  expect(() => checkBuildWithoutDatabase(env)).not.toThrow();
});

it('next.config.ts refuses it when `next build` starts on Vercel, before anything is built', async () => {
  vi.stubEnv('BUILD_WITHOUT_DATABASE', '1');
  vi.stubEnv('VERCEL', '1');
  const { default: config } = await import('../next.config');
  expect(() => config(PHASE_PRODUCTION_BUILD)).toThrow(/^BUILD_WITHOUT_DATABASE=1 is for CI and local builds only/);
  // Serving (next start, next dev) is not a build: the setting only matters there for the log line in lib/db.ts.
  expect(() => config(PHASE_PRODUCTION_SERVER)).not.toThrow();
  expect(() => config(PHASE_DEVELOPMENT_SERVER)).not.toThrow();
});

it('next.config.ts lets a CI or local build use it', async () => {
  vi.stubEnv('BUILD_WITHOUT_DATABASE', '1');
  vi.stubEnv('VERCEL', '');
  const { default: config } = await import('../next.config');
  expect(() => config(PHASE_PRODUCTION_BUILD)).not.toThrow();
});
