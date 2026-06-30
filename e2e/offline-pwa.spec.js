import { test, expect } from '@playwright/test';

const activateServiceWorker = async (page) => {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
  await expect.poll(async () => page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg?.active?.state === 'activated';
  })).toBe(true);
};

test.describe('PWA resiliency @public', () => {
  test('registers service worker on load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect.poll(async () => page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg?.installing || reg?.waiting || reg?.active);
    })).toBe(true);
  });

  test('precaches shell assets for offline resilience', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await activateServiceWorker(page);

    const precached = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        if (keys.length > 0) return true;
      }
      return false;
    });

    expect(precached).toBe(true);
  });
});
