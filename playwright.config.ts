import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 1920, height: 1080 },
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=d3d11',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @ashen-pact/server dev',
      port: 2567,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'pnpm --filter @ashen-pact/client dev --port 5173 --strictPort',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
