// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.js';
import { hasAuthCreds } from './helpers/creds.js';

test.describe('authenticated crm smoke', () => {
  test.beforeEach(() => {
    test.skip(!hasAuthCreds(), 'Set E2E_EMAIL and E2E_PASSWORD, or use seeded E2E users');
  });

  test('crm leads page loads after login', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/crm?tab=leads');
    await expect(page).toHaveURL(/\/crm/);
    await expect(page.getByText('Total Leads')).toBeVisible({ timeout: 15_000 });
  });
});
