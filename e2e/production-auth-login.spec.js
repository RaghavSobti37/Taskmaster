// @ts-check
import { test, expect } from '@playwright/test';
import { loginWithClerk, dismissOnboardingTourIfVisible } from './helpers/auth.js';
import { getTestUserCreds, hasProductionAuthCreds } from './helpers/creds.js';

const AUTH_ORIGIN = process.env.E2E_AUTH_ORIGIN || 'https://auth.tsccoreknot.com';
const APP_ORIGIN = process.env.E2E_APP_ORIGIN || 'https://tsccoreknot.com';
const DASHBOARD_ROUTE = /\/dashboard/;

const APP_CHUNK_RE =
  /AdminUsers|ArtistReleases|OrgAccounts|Dashboard|AdminCRM|ArtistFinance|ArtistMembership/i;

async function waitForLoginShell(page) {
  const cookieBtn = page.getByRole('button', { name: /^accept all$/i });
  try {
    await cookieBtn.click({ timeout: 4_000 });
  } catch {
    /* banner dismissed or absent */
  }

  // Clerk title + brand h1 both match broad text — use first() to avoid strict-mode.
  await page
    .locator('[data-clerk-sign-in-shell], .cl-rootBox, h1.cl-headerTitle')
    .or(page.getByRole('heading', { name: /^CoreKnot$/i }))
    .first()
    .waitFor({ state: 'visible', timeout: 90_000 });
}

test.describe('production auth subdomain', () => {
  test.describe.configure({ timeout: 120_000 });

  test('login page does not prefetch dashboard route chunks', async ({ page }) => {
    test.skip(process.env.E2E_PRODUCTION_AUTH !== '1', 'Set E2E_PRODUCTION_AUTH=1');

    const appChunks = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/assets\/.*\.js/i.test(url) && APP_CHUNK_RE.test(url)) {
        appChunks.push(url);
      }
    });

    await page.goto(`${AUTH_ORIGIN}/login`, { waitUntil: 'domcontentloaded' });
    await waitForLoginShell(page);
    await page.waitForTimeout(4_000);

    expect(appChunks, `unexpected dashboard chunks: ${appChunks.slice(0, 5).join(', ')}`).toEqual([]);
  });

  test('clerk email login reaches app dashboard', async ({ page }) => {
    test.skip(process.env.E2E_PRODUCTION_AUTH !== '1', 'Set E2E_PRODUCTION_AUTH=1');
    test.skip(!hasProductionAuthCreds(), 'Set E2E_EMAIL and E2E_PASSWORD for production Clerk login');

    const creds = getTestUserCreds();
    await loginWithClerk(page, {
      ...creds,
      loginUrl: `${AUTH_ORIGIN}/login`,
      expectHost: APP_ORIGIN,
    });
    await expect(page).toHaveURL(DASHBOARD_ROUTE, { timeout: 90_000 });
    await dismissOnboardingTourIfVisible(page);
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
