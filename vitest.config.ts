import { defineConfig } from 'vitest/config';

// Vitest 4 replaced the separate vitest.workspace.ts file with `test.projects`.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
  },
});
