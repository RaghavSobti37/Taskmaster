// @ts-check
import { test, expect, devices } from '@playwright/test';
import { loginAsTestUser, logout } from './helpers/auth.js';
import { hasAuthCreds } from './helpers/creds.js';
import { mockPublicAuthApi } from './helpers/publicApiMock.js';
import { clerkLoginSurface } from './helpers/orgPaths.js';

const loginSurface = clerkLoginSurface;

test.use({
  ...devices['Desktop Chrome'],
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe('mobile login', () => {
  test.beforeEach(async ({ context }) => {
    test.skip(!hasAuthCreds(), 'Set E2E_EMAIL and E2E_PASSWORD, or use seeded E2E users');
    await context.clearCookies();
  });

  test('iPhone login → logout → re-login', async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await logout(page);
    await page.goto('/login');
    await expect(loginSurface(page).first()).toBeVisible();

    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login page shows credential fields on mobile viewport', async ({ page }) => {
    await mockPublicAuthApi(page);
    await page.goto('/login');
    await expect(loginSurface(page).first()).toBeVisible();
  });
});
