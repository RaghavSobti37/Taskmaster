import { test, expect } from '@playwright/test';

test.describe('visual regression — public shell', () => {
  test('landing page layout stable', async ({ page }) => {
    await page.goto('/landing');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('landing-shell.png', {
      maxDiffPixelRatio: 0.06,
      animations: 'disabled',
    });
  });
});
