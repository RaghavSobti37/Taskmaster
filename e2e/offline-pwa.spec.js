import { test, expect } from '@playwright/test';

test.describe('PWA resiliency @public', () => {
  test('registers service worker on load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const active = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg?.installing || reg?.waiting || reg?.active);
    });
    expect(active).toBe(true);
  });

  test('serves shell when offline', async ({ page, context }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });
});
