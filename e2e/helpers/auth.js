// @ts-check
import { expect } from '@playwright/test';
import { getTestUserCreds } from './creds.js';
import { getApiBase } from './api.js';

function isSeededLocalUser(email) {
  return /@test\.coreknot\.local$/i.test(String(email || ''));
}

function shouldUseApiSession(email) {
  if (process.env.E2E_AUTH_MODE === 'api' || process.env.E2E_USE_API_LOGIN === '1') return true;
  return !process.env.E2E_EMAIL && isSeededLocalUser(email);
}

function resolvePostLoginPath(page, returnPath) {
  if (returnPath) return returnPath;
  try {
    const current = new URL(page.url());
    const redirect = current.searchParams.get('redirect');
    if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
      return redirect;
    }
    if (current.pathname === '/login' || current.pathname.endsWith('/login')) {
      const fromQuery = current.searchParams.get('redirect');
      if (fromQuery?.startsWith('/')) return fromQuery;
    }
  } catch {
    /* page may still be about:blank */
  }
  return '/dashboard';
}

/**
 * Local seeded E2E users live in Mongo, not Clerk. Use the API session cookie
 * for those fixtures so route confidence tests stay deterministic.
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string, password: string, returnPath?: string }} opts
 */
export async function loginWithApiSession(page, { email, password, returnPath }) {
  const res = await page.request.post(`${getApiBase()}/api/auth/login`, {
    data: { email, password },
  });
  if (res.status() === 410) {
    throw new Error(
      'Seeded E2E API login is disabled. Start the local API with ALLOW_LEGACY_LOGIN=true, '
      + 'or set real E2E_EMAIL/E2E_PASSWORD credentials to exercise Clerk.',
    );
  }
  if (!res.ok()) {
    throw new Error(`Seeded E2E API login failed (${res.status()}): ${await res.text()}`);
  }

  await expect.poll(async () => {
    const me = await page.request.get(`${getApiBase()}/api/auth/me`);
    return me.ok();
  }, { timeout: 30_000 }).toBe(true);

  await page.goto(resolvePostLoginPath(page, returnPath), { waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30_000 });
  await dismissCookieConsentIfVisible(page);
  await dismissOnboardingTourIfVisible(page);
}

export async function dismissCookieConsentIfVisible(page) {
  const accept = page.getByRole('button', { name: /^accept all$/i });
  try {
    await accept.waitFor({ state: 'visible', timeout: 4_000 });
    await accept.click();
    await accept.waitFor({ state: 'hidden', timeout: 5_000 });
  } catch {
    /* banner optional */
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string, password: string, loginUrl?: string, expectHost?: string }} opts
 */
export async function loginWithClerk(page, { email, password, loginUrl = '/login', expectHost }) {
  if (!email || !password) {
    throw new Error('loginWithClerk requires email and password');
  }

  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  await dismissCookieConsentIfVisible(page);

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

  const expectedHostname = (() => {
    if (!expectHost) return '';
    try {
      return new URL(expectHost).hostname;
    } catch {
      return expectHost;
    }
  })();

  await page.waitForURL(
    (url) => {
      if (expectedHostname) {
        const hostPattern = new RegExp(expectedHostname.replace(/\./g, '\\.'));
        return hostPattern.test(url.hostname) && !url.pathname.endsWith('/login');
      }
      return !url.pathname.endsWith('/login') && url.pathname.includes('/dashboard');
    },
    { timeout: 90_000 },
  );
  await dismissCookieConsentIfVisible(page);
  await dismissOnboardingTourIfVisible(page);
}

/**
 * Sign in via Clerk on auth host (legacy password form removed in production).
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string, password: string, returnPath?: string, loginUrl?: string, expectHost?: string }} creds
 */
export async function login(page, { email, password, returnPath, loginUrl, expectHost }) {
  if (!email || !password) {
    throw new Error('login requires email and password');
  }

  let resolvedReturnPath = returnPath;
  if (!resolvedReturnPath) {
    try {
      const current = new URL(page.url());
      const redirect = current.searchParams.get('redirect');
      if (redirect?.startsWith('/')) resolvedReturnPath = redirect;
    } catch {
      /* page may still be about:blank */
    }
  }

  if (shouldUseApiSession(email)) {
    await loginWithApiSession(page, { email, password, returnPath: resolvedReturnPath });
    return;
  }

  const loginPath = loginUrl
    ? loginUrl
    : returnPath
      ? `/login?redirect=${encodeURIComponent(returnPath)}`
      : '/login';

  await loginWithClerk(page, { email, password, loginUrl: loginPath, expectHost });
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
