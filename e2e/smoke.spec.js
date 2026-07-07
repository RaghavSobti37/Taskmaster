// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.js';
import { hasAuthCreds } from './helpers/creds.js';
import { mockPublicAuthApi } from './helpers/publicApiMock.js';
import { clerkLoginSurface } from './helpers/orgPaths.js';

test.describe('public smoke', () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicAuthApi(page);
  });

  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CoreKnot|Coreknot/i);
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /coreknot/i }).first()).toBeVisible();

    await expect(clerkLoginSurface(page).first()).toBeVisible();
  });
});

test.describe('authenticated smoke', () => {
  test.beforeEach(async ({ context }) => {
    test.skip(!hasAuthCreds(), 'Set E2E_EMAIL and E2E_PASSWORD, or use seeded E2E users');
    await context.clearCookies();
  });

  test('login → dashboard', async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
