// @ts-check
import { getTestUserCreds } from './creds.js';
import { getApiBase } from './api.js';

const LOGIN_RETRY_DELAYS_MS = [0, 1_500, 3_000];

/**
 * Clerk SignIn on auth.tsccoreknot.com (identifier → password → continue).
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string, password: string, loginUrl?: string, expectHost?: string }} opts
 */
export async function loginWithClerk(page, { email, password, loginUrl = '/login', expectHost }) {
  if (!email || !password) {
    throw new Error('loginWithClerk requires email and password');
  }

  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  try {
    await page.getByRole('button', { name: /^accept all$/i }).click({ timeout: 4_000 });
  } catch {
    /* cookie banner optional */
  }

  const identifier = page
    .locator('input[name="identifier"], input[type="email"], .cl-formFieldInput__identifier input')
    .first();
  await identifier.waitFor({ state: 'visible', timeout: 60_000 });
  await identifier.fill(email);

  const passwordField = page
    .locator('input[name="password"], input[type="password"], .cl-formFieldInput__password input')
    .first();

  const passwordOnSameStep = await passwordField.isVisible().catch(() => false);
  if (!passwordOnSameStep) {
    await page.locator('button.cl-formButtonPrimary, .cl-formButtonPrimary').first().click();
    await passwordField.waitFor({ state: 'visible', timeout: 30_000 });
  }

  await passwordField.fill(password);
  await page.locator('button.cl-formButtonPrimary, .cl-formButtonPrimary').last().click();

  const hostPattern = expectHost ? new RegExp(expectHost.replace(/\./g, '\\.')) : /\/dashboard/;
  await page.waitForURL(
    (url) => hostPattern.test(url.hostname) && !url.pathname.endsWith('/login'),
    { timeout: 90_000 },
  );
  await dismissOnboardingTourIfVisible(page);
}

/**
 * Sign in via the login page (legacy form or Clerk).
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string, password: string, returnPath?: string, loginUrl?: string, expectHost?: string }} creds
 */
export async function login(page, { email, password, returnPath, loginUrl, expectHost }) {
  if (!email || !password) {
    throw new Error('login requires email and password');
  }

  const loginPath = loginUrl
    ? loginUrl
    : returnPath
      ? `/login?redirect=${encodeURIComponent(returnPath)}`
      : '/login';

  const loginError = page.getByText(/authentication failed|too many login attempts|couldn't find your account/i);
  let lastError = 'Login failed';

  for (let attempt = 0; attempt < LOGIN_RETRY_DELAYS_MS.length; attempt += 1) {
    if (LOGIN_RETRY_DELAYS_MS[attempt] > 0) {
      await page.waitForTimeout(LOGIN_RETRY_DELAYS_MS[attempt]);
    }

    await page.goto(loginPath, { waitUntil: 'domcontentloaded' });

    const legacyUser = page.locator('input[autocomplete="username"]');
    const clerkShell = page.locator('[data-clerk-sign-in-shell], .cl-rootBox, input[name="identifier"]');

    const formKind = await Promise.race([
      legacyUser.waitFor({ state: 'visible', timeout: 12_000 }).then(() => 'legacy'),
      clerkShell.first().waitFor({ state: 'visible', timeout: 12_000 }).then(() => 'clerk'),
    ]).catch(() => null);

    if (formKind === 'clerk') {
      await loginWithClerk(page, { email, password, loginUrl: loginPath, expectHost });
      return;
    }

    if (formKind !== 'legacy') {
      lastError = 'Login form did not appear';
      continue;
    }

    await legacyUser.fill(email);
    await page.locator('input[autocomplete="current-password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    const outcome = await Promise.race([
      page
        .waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30_000 })
        .then(() => 'ok'),
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

  throw new Error(`${lastError} — check E2E credentials and API health`);
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
