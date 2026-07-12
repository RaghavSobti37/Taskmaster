const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const repoRoot = path.resolve(__dirname, '..');
const skipWebServer = process.env.E2E_SKIP_WEBSERVER === '1';
const usePreviewClient = process.env.E2E_CLIENT_MODE === 'preview';
const baseURL =
  process.env.E2E_BASE_URL ||
  (skipWebServer ? 'http://127.0.0.1:5173' : 'http://127.0.0.1:4173');
const apiHealthUrl = process.env.E2E_API_URL
  ? `${process.env.E2E_API_URL.replace(/\/$/, '')}/api/health`
  : 'http://127.0.0.1:5000/api/health';

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['**/*.spec.js', '**/*.smoke.js'],
  timeout: 60_000,
  // ponytail: one baseline — no -linux/-win32 suffix drift
  snapshotPathTemplate: '{testDir}/{testFileName}-snapshots/{arg}{ext}',
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: 'node server.js',
          cwd: path.join(repoRoot, 'Taskmaster/server'),
          url: apiHealthUrl,
          reuseExistingServer: false,
          timeout: 180_000,
          env: {
            ...process.env,
            ALLOW_LEGACY_LOGIN: 'true',
          },
        },
        {
          command: usePreviewClient
            ? 'npm run build --prefix Taskmaster/client && npm run preview --prefix Taskmaster/client -- --host 127.0.0.1 --port 4173 --strictPort'
            : 'npm run dev --prefix Taskmaster/client -- --host 127.0.0.1 --port 4173 --strictPort',
          cwd: repoRoot,
          url: baseURL,
          reuseExistingServer: false,
          timeout: usePreviewClient ? 300_000 : 180_000,
        },
      ],
});
