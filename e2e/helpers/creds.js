// @ts-check

export const DEFAULT_SEED_PASSWORD = '1Million#';
export const SEEDED_ADMIN_EMAIL = 'e2e-dept-admin@test.coreknot.local';
export const SEEDED_OPS_EMAIL = 'e2e-dept-ops@test.coreknot.local';
export const SEEDED_SALES_EMAIL = 'e2e-dept-sales@test.coreknot.local';
export const SEEDED_ARTIST_EMAIL = 'e2e-dept-artist-management@test.coreknot.local';

/** True when explicit E2E_EMAIL/PASSWORD set, or seeded local users (default). */
export function hasAuthCreds() {
  const hasExplicit = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
  const hasSeeded = !process.env.E2E_EMAIL && !process.env.E2E_PASSWORD;
  return hasExplicit || hasSeeded;
}

/** Primary login user for authenticated smoke — dept-admin when using seeded creds. */
export function getTestUserCreds() {
  const password = process.env.E2E_PASSWORD || DEFAULT_SEED_PASSWORD;
  const email = process.env.E2E_EMAIL || SEEDED_ADMIN_EMAIL;
  return { email, password };
}
