const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const repoRoot = path.resolve(__dirname, '..');
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const skipWebServer = process.env.E2E_SKIP_WEBSERVER === '1';

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: 'npm run preview --prefix client -- --host 127.0.0.1 --port 4173',
        cwd: repoRoot,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
