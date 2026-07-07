import { test, expect } from '@playwright/test';

// Vite dev server does not register the production service worker.
const pwaReady = process.env.E2E_PWA_BUILD === '1';

const waitForServiceWorker = async (page) => {
  await expect.poll(async () => page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg?.installing || reg?.waiting || reg?.active);
  }), { timeout: 30_000 }).toBe(true);
};

const hasPrecachedAssets = async (page) =>
  page.evaluate(async () => {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      if (keys.length > 0) return true;
    }
    return false;
  });

test.describe('PWA resiliency @public', () => {
  test.beforeEach(() => {
    test.skip(!pwaReady, 'Set E2E_PWA_BUILD=1 with preview build — vite dev has no SW');
  });

  test('registers service worker on load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await waitForServiceWorker(page);
  });

  test('precaches shell assets for offline resilience', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await waitForServiceWorker(page);

    // ponytail: workbox precache runs during install — no need to force activation
    await expect.poll(() => hasPrecachedAssets(page), { timeout: 30_000 }).toBe(true);
  });
});
