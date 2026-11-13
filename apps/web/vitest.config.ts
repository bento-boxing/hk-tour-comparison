import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@hktours/web',
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
