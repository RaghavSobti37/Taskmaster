// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.js';
import { hasAuthCreds } from './helpers/creds.js';

test.describe('authenticated todo smoke', () => {
  test.beforeEach(() => {
    test.skip(!hasAuthCreds(), 'Set E2E_EMAIL and E2E_PASSWORD, or use seeded E2E users');
  });

  test('todo page loads after login', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/todo');
    await expect(page).toHaveURL(/\/todo/);
    await expect(page.getByPlaceholder('Search tasks...')).toBeVisible({ timeout: 15_000 });
  });
});
