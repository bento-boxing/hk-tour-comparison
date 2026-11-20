import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@hktours/web',
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // The site's identity (lib/site-identity.ts) for every test: invented values that replace whatever the shell
    // has, so the tests never read or depend on the real ones, here or in CI. A test of a missing or malformed
    // value sets its own with vi.stubEnv.
    env: { SITE_URL: 'https://example.invalid', CONTACT_EMAIL: 'bot@example.invalid' },
  },
});
