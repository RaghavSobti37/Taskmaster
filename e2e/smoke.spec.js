// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.js';
import { hasAuthCreds } from './helpers/creds.js';

test.describe('public smoke', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CoreKnot|Coreknot/i);
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    const username = page.locator('input[autocomplete="username"]');
    await expect(username).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/coreknot/i);
  });
});

test.describe('authenticated smoke', () => {
  test.beforeEach(() => {
    test.skip(!hasAuthCreds(), 'Set E2E_EMAIL and E2E_PASSWORD, or use seeded E2E users');
  });

  test('login → dashboard', async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
