import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@ashen-pact/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts', 'packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts'],
    environment: 'node',
    // Cap worker concurrency to avoid SMT/thermal oversubscription across heavy 60Hz balance/soak suites
    minWorkers: 1,
    maxWorkers: 3,
  },
});
