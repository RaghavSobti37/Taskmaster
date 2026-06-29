// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.js';
import { hasAuthCreds } from './helpers/creds.js';

test.describe('dashboard widgets', () => {
  test.beforeEach(() => {
    test.skip(!hasAuthCreds(), 'Set E2E_EMAIL and E2E_PASSWORD, or use seeded E2E users');
  });

  test('priority widgets render or show error banner after login', async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    const errorBanner = page.getByRole('alert').filter({ hasText: /failed to load/i });
    const hasError = await errorBanner.count();

    if (hasError > 0) {
      await expect(errorBanner.first()).toBeVisible();
      return;
    }

    // At least one priority widget shell should mount (task list, calendar, or announcements)
    const widgetSignals = page.locator(
      'text=/Today Tasks|Today\'s Calendar|Announcements|Review Queue|Overdue Tasks/i'
    );
    await expect(widgetSignals.first()).toBeVisible({ timeout: 15000 });
  });
});
