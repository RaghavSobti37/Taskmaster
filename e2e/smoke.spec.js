// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.js';

const hasAuthCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe('public smoke', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CoreKnot|Coreknot/i);
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /coreknot/i })).toBeVisible();
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
  });
});

test.describe('authenticated smoke', () => {
  test.beforeEach(() => {
    test.skip(!hasAuthCreds, 'Set E2E_EMAIL and E2E_PASSWORD for auth smoke');
  });

  test('login → dashboard', async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
