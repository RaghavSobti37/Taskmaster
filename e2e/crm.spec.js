// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.js';

const hasAuthCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe('authenticated crm smoke', () => {
  test.beforeEach(() => {
    test.skip(!hasAuthCreds, 'Set E2E_EMAIL and E2E_PASSWORD for auth smoke');
  });

  test('crm leads page loads after login', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/crm/leads');
    await expect(page).toHaveURL(/\/crm\/leads/);
    await expect(page.getByRole('heading', { name: /leads/i })).toBeVisible({ timeout: 15_000 });
  });
});
