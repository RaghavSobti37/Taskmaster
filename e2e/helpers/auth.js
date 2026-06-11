// @ts-check
import { getTestUserCreds } from './creds.js';
import { getApiBase } from './api.js';

const LOGIN_RETRY_DELAYS_MS = [0, 1_500, 3_000];

/**
 * Sign in via the login page.
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string, password: string, returnPath?: string }} creds
 */
export async function login(page, { email, password, returnPath }) {
  if (!email || !password) {
    throw new Error('login requires email and password');
  }

  const loginPath = returnPath
    ? `/login?redirect=${encodeURIComponent(returnPath)}`
    : '/login';

  const loginError = page.getByText(/authentication failed|too many login attempts/i);
  let lastError = 'Login failed';

  for (let attempt = 0; attempt < LOGIN_RETRY_DELAYS_MS.length; attempt += 1) {
    if (LOGIN_RETRY_DELAYS_MS[attempt] > 0) {
      await page.waitForTimeout(LOGIN_RETRY_DELAYS_MS[attempt]);
    }

    await page.goto(loginPath);
    await page.locator('input[autocomplete="username"]').fill(email);
    await page.locator('input[autocomplete="current-password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    const outcome = await Promise.race([
      page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30_000 }).then(() => 'ok'),
      loginError.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'login_error'),
    ]);

    if (outcome === 'ok') {
      await dismissOnboardingTourIfVisible(page);
      return;
    }

    lastError = (await loginError.textContent())?.trim() || 'Login failed';
    const transient =
      /too many login attempts/i.test(lastError) ||
      /network|fetch|proxy|connection|reset|refused/i.test(lastError);
    if (!transient) break;
  }

  throw new Error(`${lastError} — check E2E credentials and API health on :5000`);
}

/**
 * Sign in via the login page. Requires E2E_EMAIL and E2E_PASSWORD.
 * @param {import('@playwright/test').Page} page
 */
/**
 * New users may get the dashboard onboarding tour — dismiss so it does not block clicks.
 * @param {import('@playwright/test').Page} page
 */
export async function dismissOnboardingTourIfVisible(page) {
  const skipTour = page.getByRole('button', { name: /skip tutorial/i });
  try {
    await skipTour.waitFor({ state: 'visible', timeout: 5_000 });
    await skipTour.click();
    await skipTour.waitFor({ state: 'hidden', timeout: 5_000 });
  } catch {
    /* tour not active */
  }
}

export async function loginAsTestUser(page) {
  await login(page, getTestUserCreds());
}

/** Clear session cookies so /login is reachable again. */
export async function logout(page) {
  try {
    await page.request.post(`${getApiBase()}/api/auth/logout`);
  } catch {
    /* best-effort */
  }
  await page.context().clearCookies();
}
