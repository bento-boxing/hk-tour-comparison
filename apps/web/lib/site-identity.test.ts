import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from 'next/constants';

// SITE_URL and CONTACT_EMAIL are the test config's invented values (vitest.config.ts); a test that needs them
// missing or malformed sets its own with vi.stubEnv.

/** How many times core's check has run, through a pass-through wrapper. */
const checks = vi.hoisted(() => ({ count: 0 }));
vi.mock('@hktours/core', async importOriginal => {
  const core = await importOriginal<typeof import('@hktours/core')>();
  return {
    ...core,
    resolveSiteIdentity: (env: Parameters<typeof core.resolveSiteIdentity>[0]) => {
      checks.count++;
      return core.resolveSiteIdentity(env);
    },
  };
});

/** The modules afresh, as a new server process loads them. */
async function load() {
  vi.resetModules();
  return {
    ...(await import('./site-identity')),
    ...(await import('./locale-path')),
    ...(await import('./site-metadata')),
    ...(await import('./i18n')),
    robots: (await import('../app/robots')).default,
  };
}

beforeEach(() => { checks.count = 0; });
afterEach(() => { vi.unstubAllEnvs(); });

describe('siteIdentity', () => {
  it('is the two settings, from process.env', async () => {
    const { siteIdentity } = await load();
    expect(siteIdentity()).toEqual({ siteUrl: 'https://example.invalid', contactEmail: 'bot@example.invalid' });
  });

  it('checks them once per process: however many requests and pages use them, the check runs once', async () => {
    const { siteIdentity, siteUrl, languageAlternates, pageMetadata, siteMetadata, makeT, robots } = await load();
    expect(checks.count).toBe(0); // loading the modules checks nothing
    const t = makeT('en');
    for (let request = 0; request < 1000; request++) {
      siteMetadata(t);
      pageMetadata(t, '/chain');
      languageAlternates('/tours/japan');
      siteUrl('/about');
      robots();
      siteIdentity();
    }
    expect(checks.count).toBe(1);
    expect(siteUrl('/en/chain')).toBe('https://example.invalid/en/chain');
  });

  it('keeps what it read: a later change to process.env does not reach a running server', async () => {
    const { siteIdentity } = await load();
    siteIdentity();
    vi.stubEnv('SITE_URL', 'https://changed.invalid');
    expect(siteIdentity().siteUrl).toBe('https://example.invalid');
  });

  it.each([
    ['SITE_URL', '', /^SITE_URL is not set: /],
    ['SITE_URL', 'https://example.invalid/', /^SITE_URL ends with a slash: /],
    ['CONTACT_EMAIL', '', /^CONTACT_EMAIL is not set: /],
    ['CONTACT_EMAIL', 'not-an-address', /^CONTACT_EMAIL is not an e-mail address: /],
  ])('with %s %j it throws core\'s message, and so does every page that uses it', async (name, value, message) => {
    vi.stubEnv(name, value);
    const { siteIdentity, siteUrl, siteMetadata, makeT, robots } = await load();
    expect(() => siteIdentity()).toThrow(message);
    expect(() => siteUrl('/')).toThrow(message);
    expect(() => siteMetadata(makeT('zh-Hant'))).toThrow(message);
    expect(() => robots()).toThrow(message);
  });

  it('has no default: with neither set, it throws naming both', async () => {
    vi.stubEnv('SITE_URL', undefined);
    vi.stubEnv('CONTACT_EMAIL', undefined);
    const { siteIdentity } = await load();
    expect(() => siteIdentity()).toThrow(/^SITE_URL is not set: .*; CONTACT_EMAIL is not set: /);
  });
});

describe('next.config.ts', () => {
  const PHASES = [PHASE_PRODUCTION_BUILD, PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER];

  async function config() {
    vi.resetModules();
    return (await import('../next.config')).default;
  }

  it.each(PHASES)('%s: checks the settings before anything is built or served', async phase => {
    const make = await config();
    expect(make(phase).transpilePackages).toEqual(['@hktours/core', '@hktours/db']);
    expect(checks.count).toBe(1);
  });

  it.each(PHASES.flatMap(phase => [
    [phase, 'SITE_URL', undefined, /^SITE_URL is not set: /],
    [phase, 'CONTACT_EMAIL', undefined, /^CONTACT_EMAIL is not set: /],
    [phase, 'SITE_URL', 'http://example.invalid', /^SITE_URL must start with https:\/\/ /],
    [phase, 'CONTACT_EMAIL', 'bot@', /^CONTACT_EMAIL is not an e-mail address: /],
  ] as const))('%s with %s %j: stops with core\'s message (the build fails)', async (phase, name, value, message) => {
    vi.stubEnv(name, value);
    const make = await config();
    expect(() => make(phase)).toThrow(message);
  });

  it('`next typegen` (pnpm typecheck) needs neither: it only writes route types', async () => {
    vi.stubEnv('SITE_URL', undefined);
    vi.stubEnv('CONTACT_EMAIL', undefined);
    const make = await config();
    const argv = process.argv;
    process.argv = [...argv.slice(0, 2), 'typegen'];
    try {
      expect(make(PHASE_PRODUCTION_BUILD).transpilePackages).toEqual(['@hktours/core', '@hktours/db']);
    } finally {
      process.argv = argv;
    }
    expect(() => make(PHASE_PRODUCTION_BUILD)).toThrow(/^SITE_URL is not set: /);
    expect(checks.count).toBe(1);
  });
});
