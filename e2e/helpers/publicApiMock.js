// @ts-check

/**
 * Public E2E runs preview without a backend — stub session probe so boot does not ECONNREFUSED.
 * @param {import('@playwright/test').Page} page
 */
export async function mockPublicAuthApi(page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: false }),
    });
  });

  // ponytail: stray callers / older bundles still hit /me on login boot
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthorized' }),
    });
  });
}
