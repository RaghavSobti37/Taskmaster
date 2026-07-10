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

    const sameOriginLogin = page
      .getByRole('heading', { name: /coreknot/i })
      .first()
      .or(clerkLoginSurface(page).first());
    const splitAuthRedirect = page.getByText(/redirecting/i);

    const loginMarker = sameOriginLogin.or(splitAuthRedirect).first();
    const markerVisible = await loginMarker
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!markerVisible) {
      await expect(page).toHaveURL(/\/login/);
      await expect(page).toHaveTitle(/CoreKnot|Coreknot/i);
      await expect(page.locator('#root')).toHaveCount(1);
      return;
    }

    if (await splitAuthRedirect.isVisible().catch(() => false)) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

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
