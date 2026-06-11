// @ts-check
/**
 * Agent exploration template — one smoke test per major route, per user archetype.
 * Requires auth-setup first: e2e/.auth/{archetype}.json
 */
import { test, expect } from '@playwright/test';
import { getE2EUsers, hasStorageState, storageStatePath } from './fixtures/multiUser.js';
import { routesForUser } from './fixtures/routes.js';

const users = getE2EUsers();

test.describe.configure({ mode: 'parallel' });

for (const user of users) {
  const routes = routesForUser(user);

  test.describe(`explore as ${user.archetype}`, () => {
    test.beforeEach(() => {
      test.skip(
        !hasStorageState(user.archetype),
        `Run auth-setup first — missing ${storageStatePath(user.archetype)}`,
      );
    });

    test.use({ storageState: storageStatePath(user.archetype) });

    for (const route of routes) {
      test(`${route.label} (${route.path})`, async ({ page }) => {
        await page.goto(route.path);
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.locator('body')).not.toBeEmpty();
      });
    }
  });
}

if (users.length === 0) {
  test('no E2E users configured', () => {
    test.skip(true, 'Set emails in .agents/e2e-users.json or E2E_USER_*_EMAIL env vars');
  });
}
