// @ts-check
import { test, expect, request as playwrightRequest } from '@playwright/test';
import { dismissOnboardingTourIfVisible, login } from './helpers/auth.js';
import {
  DEFAULT_SEED_PASSWORD,
  SEEDED_ARTIST_EMAIL,
  SEEDED_OPS_EMAIL,
  SEEDED_SALES_EMAIL,
  hasAuthCreds,
} from './helpers/creds.js';
import {
  apiLogin,
  deleteUserById,
  ensurePasswordGateUser,
  fetchFirstArtistId,
  getApiBase,
} from './helpers/api.js';
import { orgAppPath } from './helpers/orgPaths.js';

const e2ePassword = process.env.E2E_PASSWORD || DEFAULT_SEED_PASSWORD;
const loginEmail = process.env.E2E_LOGIN_EMAIL || SEEDED_OPS_EMAIL;
const redirectEmail = process.env.E2E_REDIRECT_EMAIL || SEEDED_SALES_EMAIL;
const artistEmail = process.env.E2E_ARTIST_EMAIL || SEEDED_ARTIST_EMAIL;
const GATE_NEW_PASSWORD = process.env.E2E_PASSWORD_GATE_NEW_PASSWORD || 'SecureGate9!';

test.describe('login redirect', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('protected route → login → returns to original path', async ({ page }) => {
    test.skip(!hasAuthCreds(), 'Set E2E_EMAIL and E2E_PASSWORD, or use seeded E2E users');

    await page.goto(orgAppPath('/todo'));
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    await login(page, {
      email: loginEmail,
      password: e2ePassword,
    });

    await expect(page).toHaveURL(/\/todo/, { timeout: 30_000 });
    await expect(page.getByPlaceholder('Search tasks...')).toBeVisible({ timeout: 15_000 });
  });

  test('?redirect= → login → lands on redirect path', async ({ page }) => {
    test.skip(!hasAuthCreds(), 'Set E2E_EMAIL and E2E_PASSWORD, or use seeded E2E users');

    const returnPath = '/crm?tab=leads';

    await login(page, {
      email: redirectEmail,
      password: e2ePassword,
      returnPath,
    });

    await expect(page).toHaveURL(/\/crm/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: /add lead/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('password gate', () => {
  /** @type {import('@playwright/test').APIRequestContext | null} */
  let apiContext = null;
  /** @type {{ email: string, password: string, userId: string } | null} */
  let gateUser = null;
  let gateSetupReason = '';

  test.beforeAll(async () => {
    if (!hasAuthCreds()) {
      gateSetupReason = 'Set E2E_EMAIL and E2E_PASSWORD, or run without them to use seeded E2E users';
      return;
    }

    apiContext = await playwrightRequest.newContext({ baseURL: getApiBase() });
    try {
      const health = await apiContext.get(`${getApiBase()}/api/health`);
      if (!health.ok()) {
        gateSetupReason = `API health check failed (${health.status()})`;
        return;
      }
      gateUser = await ensurePasswordGateUser(apiContext);
    } catch (err) {
      gateUser = null;
      gateSetupReason = err.message || 'Password gate user setup failed';
      console.warn(`password gate setup skipped: ${gateSetupReason}`);
    }
  });

  test.afterAll(async () => {
    await apiContext?.dispose();
  });

  test('mustChangePassword gate clears after profile password save', async ({ page, context }) => {
    test.skip(!gateUser, gateSetupReason || 'Password gate user could not be created — is API on :5000?');

    await context.clearCookies();
    await login(page, { email: gateUser.email, password: gateUser.password });
    await dismissOnboardingTourIfVisible(page);

    await expect(page.getByRole('dialog').getByText(/password change required/i)).toBeVisible({
      timeout: 15_000,
    });
    await dismissOnboardingTourIfVisible(page);
    await page.goto(orgAppPath('/settings?tab=profile'));
    await expect(page).toHaveURL(/\/settings/, { timeout: 15_000 });
    await expect(page).toHaveURL(/tab=profile/);
    await expect(page.getByText(/temporary password/i)).toBeVisible({ timeout: 15_000 });
    await dismissOnboardingTourIfVisible(page);

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(GATE_NEW_PASSWORD);
    await passwordInputs.nth(1).fill(GATE_NEW_PASSWORD);
    await page.getByRole('button', { name: /save new password/i }).click();

    await expect(page.getByRole('dialog').getByText(/password change required/i)).toBeHidden({
      timeout: 15_000,
    });

    await page.goto(orgAppPath('/dashboard'));
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole('dialog').getByText(/password change required/i)).toHaveCount(0);
  });
});

test.describe('artist OS smoke', () => {
  test.beforeEach(() => {
    test.skip(!hasAuthCreds(), 'Set E2E_EMAIL and E2E_PASSWORD for artist OS smoke');
  });

  test('team member or admin can open artist detail OS tab', async ({ page }) => {
    await login(page, { email: artistEmail, password: e2ePassword });

    let artistId = process.env.E2E_ARTIST_ID || null;
    if (!artistId) {
      const api = await playwrightRequest.newContext({ baseURL: getApiBase() });
      try {
        await apiLogin(api, {
          email: artistEmail,
          password: e2ePassword,
        });
        artistId = await fetchFirstArtistId(api);
      } finally {
        await api.dispose();
      }
    }

    test.skip(!artistId, 'No artists in DB — seed data or set E2E_ARTIST_ID');

    await page.goto(orgAppPath(`/artists/${artistId}?tab=overview`));

    await expect(page.getByRole('tablist', { name: /artist os sections/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('tab', { name: /^overview$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /inquiries/i })).toBeVisible();

    await page.getByRole('tab', { name: /inquiries/i }).click();
    await expect(page).toHaveURL(/tab=inquiries/);
    await expect(page.getByRole('tab', { name: /inquiries/i, selected: true })).toBeVisible();
  });
});
