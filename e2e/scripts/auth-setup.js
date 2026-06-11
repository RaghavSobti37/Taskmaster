// @ts-check
/**
 * One-time (or refresh) auth bootstrap for multi-user Playwright sessions.
 * Saves isolated storageState per archetype under e2e/.auth/{archetype}.json
 */
import { test as setup } from '@playwright/test';
import {
  getE2EUsers,
  loginUser,
  saveStorageState,
  ensureAuthDir,
} from '../fixtures/multiUser.js';

const users = getE2EUsers();

if (users.length === 0) {
  setup('no E2E users configured — set emails in .agents/e2e-users.json or env', () => {
    setup.skip(true, 'No resolvable E2E user emails');
  });
} else {
  ensureAuthDir();

  const authUsers = users.filter((user) => user.archetype !== 'pw-gate');

  for (const user of authUsers) {
    setup(`authenticate ${user.archetype}`, async ({ page, context }) => {
      await context.clearCookies();
      await loginUser(page, user);
      await saveStorageState(context, user);
    });
  }
}
