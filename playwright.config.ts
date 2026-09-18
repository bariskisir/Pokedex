/** Runs production-renderer and Electron smoke tests against deterministic API fixtures. */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testMatch: ['app.spec.ts', 'device.spec.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 } },
    },
    { name: 'electron', testMatch: 'electron.spec.ts' },
    { name: 'package', testMatch: 'package.spec.ts' },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
