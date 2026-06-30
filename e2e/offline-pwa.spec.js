import { test, expect } from '@playwright/test';

async function waitForServiceWorker(page) {
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg?.installing || reg?.waiting || reg?.active);
  }, { timeout: 20_000 });
}

test.describe('PWA resiliency @public', () => {
  test('registers service worker on load', async ({ page }) => {
    await page.goto('/');
    await waitForServiceWorker(page);

    const active = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg?.installing || reg?.waiting || reg?.active);
    });
    expect(active).toBe(true);
  });

  test('serves shell when offline', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForServiceWorker(page);

    await context.setOffline(true);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#root')).toBeVisible();
  });
});
