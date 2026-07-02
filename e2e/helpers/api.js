// @ts-check
import { request as playwrightRequest } from '@playwright/test';

const DEFAULT_SEED_PASSWORD = '1Million#';
const SEEDED_ADMIN_EMAIL = 'e2e-dept-admin@test.coreknot.local';
const DEFAULT_GATE_EMAIL = 'e2e-pw-gate@test.coreknot.local';
const DEFAULT_GATE_TEMP_PASSWORD = 'E2eGateTemp1!';

/**
 * @returns {string}
 */
export function getApiBase() {
  return (process.env.E2E_API_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
}

/**
 * Admin API creds for E2E setup — prefer seeded dept-admin, not production E2E_EMAIL.
 * @returns {{ email: string, password: string }}
 */
export function getAdminApiCreds() {
  const email =
    process.env.E2E_ADMIN_API_EMAIL ||
    process.env.E2E_USER_ADMIN_EMAIL ||
    SEEDED_ADMIN_EMAIL;
  const password =
    process.env.E2E_ADMIN_API_PASSWORD ||
    process.env.E2E_PASSWORD ||
    DEFAULT_SEED_PASSWORD;
  return { email, password };
}

/**
 * @param {import('@playwright/test').APIRequestContext} api
 * @param {{ email: string, password: string }} creds
 */
export async function apiLogin(api, { email, password }) {
  const res = await api.post(`${getApiBase()}/api/auth/login`, {
    data: { email, password },
  });
  if (res.status() === 410) {
    throw new Error(
      'API password login disabled (Clerk-only). Use browser Clerk sign-in or set ALLOW_LEGACY_LOGIN=true for local API setup.',
    );
  }
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`API login failed (${res.status()}): ${body}`);
  }
  return res;
}

/**
 * @param {import('@playwright/test').APIRequestContext} api
 * @param {string} email
 * @returns {Promise<string | null>}
 */
export async function findUserIdByEmail(api, email) {
  const target = email.trim().toLowerCase();
  let page = 1;
  let pages = 1;

  while (page <= pages) {
    const res = await api.get(`${getApiBase()}/api/users/directory`, {
      params: { page: String(page), limit: '100' },
    });
    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`findUserIdByEmail failed (${res.status()}): ${body}`);
    }

    const payload = await res.json();
    const users = Array.isArray(payload?.users) ? payload.users : [];
    const hit = users.find((user) => String(user.email || '').toLowerCase() === target);
    if (hit?._id) return hit._id;

    pages = Number(payload?.pagination?.pages) || 1;
    page += 1;
  }

  return null;
}

/**
 * Admin session required. Creates a user flagged mustChangePassword.
 * @param {import('@playwright/test').APIRequestContext} api
 * @param {{ name?: string, email?: string }} [overrides]
 * @returns {Promise<{ email: string, password: string, userId: string }>}
 */
export async function createPasswordGateUser(api, overrides = {}) {
  const email = overrides.email || DEFAULT_GATE_EMAIL;
  const name = overrides.name || 'E2E Password Gate';

  const res = await api.post(`${getApiBase()}/api/users`, {
    data: { name, email },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`createPasswordGateUser failed (${res.status()}): ${body}`);
  }

  const payload = await res.json();
  return {
    email: payload.credentials.email,
    password: payload.credentials.temporaryPassword,
    userId: payload.user._id,
  };
}

/**
 * @param {import('@playwright/test').APIRequestContext} api
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ email: string, password: string, userId: string | null } | null>}
 */
export async function trySeededPasswordGateUser(api, email, password) {
  const probe = await playwrightRequest.newContext({ baseURL: getApiBase() });
  try {
    const res = await probe.post(`${getApiBase()}/api/auth/login`, {
      data: { email, password },
    });
    if (!res.ok()) return null;

    const body = await res.json();
    if (!body?.mustChangePassword) return null;

    const userId = body?._id || body?.id || (await findUserIdByEmail(api, email));
    return { email, password, userId: userId || null };
  } finally {
    await probe.dispose();
  }
}

/**
 * Idempotent password-gate fixture: reuse seeded user or recreate via dept-admin API.
 * Avoids hammering production E2E_EMAIL; prefers seedE2eUsers pw-gate account when ready.
 * @param {import('@playwright/test').APIRequestContext} [existingApi]
 * @returns {Promise<{ email: string, password: string, userId: string | null }>}
 */
export async function ensurePasswordGateUser(existingApi) {
  if (process.env.E2E_PASSWORD_GATE_EMAIL && process.env.E2E_PASSWORD_GATE_PASSWORD) {
    if (process.env.E2E_PASSWORD_GATE_SKIP_RESET === '1') {
      return {
        email: process.env.E2E_PASSWORD_GATE_EMAIL,
        password: process.env.E2E_PASSWORD_GATE_PASSWORD,
        userId: process.env.E2E_PASSWORD_GATE_USER_ID || null,
      };
    }
  }

  const gateEmail = process.env.E2E_PASSWORD_GATE_EMAIL || DEFAULT_GATE_EMAIL;
  const gateTempPassword = process.env.E2E_PASSWORD_GATE_TEMP_PASSWORD || DEFAULT_GATE_TEMP_PASSWORD;
  const ownsApi = !existingApi;
  const api = existingApi || (await playwrightRequest.newContext({ baseURL: getApiBase() }));

  try {
    const seeded = await trySeededPasswordGateUser(api, gateEmail, gateTempPassword);
    if (seeded) return seeded;

    await apiLogin(api, getAdminApiCreds());

    const existingId = await findUserIdByEmail(api, gateEmail);
    if (existingId) {
      await deleteUserById(api, existingId);
    }

    return await createPasswordGateUser(api, { email: gateEmail });
  } finally {
    if (ownsApi) {
      await api.dispose();
    }
  }
}

/**
 * @param {import('@playwright/test').APIRequestContext} api
 * @param {string} userId
 */
export async function deleteUserById(api, userId) {
  const res = await api.delete(`${getApiBase()}/api/users/${userId}`);
  if (!res.ok() && res.status() !== 404) {
    const body = await res.text();
    throw new Error(`deleteUserById failed (${res.status()}): ${body}`);
  }
}

/**
 * @param {import('@playwright/test').APIRequestContext} api
 * @returns {Promise<string | null>}
 */
export async function fetchFirstArtistId(api) {
  const res = await api.get(`${getApiBase()}/api/artists`);
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`fetchFirstArtistId failed (${res.status()}): ${body}`);
  }
  const artists = await res.json();
  const list = Array.isArray(artists) ? artists : artists?.artists;
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[0]._id || list[0].id || null;
}
