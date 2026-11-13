import { defineProject } from 'vitest/config';

// PGlite-backed tests (createTestDb) can exceed Vitest's 5-second default when the machine is busy.
export default defineProject({
  test: {
    name: '@hktours/scraper',
    testTimeout: 15_000,
  },
});
