// @ts-check
import { test, expect, devices } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.js';

const hasAuthCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.use({ ...devices['iPhone 13'] });

test.describe('mobile login', () => {
  test.beforeEach(() => {
    test.skip(!hasAuthCreds, 'Set E2E_EMAIL and E2E_PASSWORD for mobile login E2E');
  });

  test('iPhone login → logout → re-login', async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/login');
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();

    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login page shows credential fields on mobile viewport', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});
