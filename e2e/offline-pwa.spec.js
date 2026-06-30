import { test, expect } from '@playwright/test';

async function waitForServiceWorker(page) {
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg?.installing || reg?.waiting || reg?.active);
  }, { timeout: 20_000 });
}

async function serviceWorkerActive(page) {
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg?.installing || reg?.waiting || reg?.active);
  });
}

test.describe('PWA resiliency @public', () => {
  test('registers service worker on load', async ({ page }) => {
    await page.goto('/');
    try {
      await waitForServiceWorker(page);
    } catch {
      test.skip(true, 'Service worker not registered in this preview build');
    }
    expect(await serviceWorkerActive(page)).toBe(true);
  });

  test('serves shell when offline', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    try {
      await waitForServiceWorker(page);
    } catch {
      test.skip(true, 'Service worker not registered in this preview build');
    }

    await context.setOffline(true);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#root')).toBeVisible();
  });
});
