// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.js';

const hasAuthCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe('authenticated flows', () => {
  test.beforeEach(() => {
    test.skip(!hasAuthCreds, 'Set E2E_EMAIL and E2E_PASSWORD for auth flows');
  });

  test('login → dashboard shell', async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('? opens keyboard shortcuts overlay', async ({ page }) => {
    await loginAsTestUser(page);
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeVisible();
    await expect(page.getByText(/command palette/i)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeHidden();
  });

  test('notes composer shows unsaved changes bar', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/notes');
    await expect(page.getByRole('heading', { name: /^notes$/i })).toBeVisible();

    const titleInput = page.getByPlaceholder('Note title');
    await titleInput.fill(`E2E unsaved ${Date.now()}`);
    await expect(page.getByText(/careful — you have unsaved changes/i)).toBeVisible();
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(titleInput).toHaveValue('');
  });

  test('settings security tab lists sessions', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/settings?tab=security');
    await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible();
    await expect(page.getByText(/this device/i)).toBeVisible({ timeout: 15_000 });
  });
});
