// @ts-check

/**
 * Sign in via the login page. Requires E2E_EMAIL and E2E_PASSWORD.
 * @param {import('@playwright/test').Page} page
 */
export async function loginAsTestUser(page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error('Set E2E_EMAIL and E2E_PASSWORD for authenticated E2E');
  }

  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}
