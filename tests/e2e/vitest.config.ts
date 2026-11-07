import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@ashen-pact/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      phaser: path.resolve(__dirname, './helpers/phaser-mock.ts'),
    },
  },
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    environment: 'node',
    minWorkers: 1,
    maxWorkers: 3,
  },
});
