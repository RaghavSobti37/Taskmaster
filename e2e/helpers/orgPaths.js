// @ts-check

/** Default tenant slug for local seeded E2E (override with E2E_ORG_SLUG). */
export const DEFAULT_ORG_SLUG = process.env.E2E_ORG_SLUG || 'tsc';

/**
 * Org-prefixed app path matching VITE_ORG_SLUG_ROUTES (e.g. /tsc/todo).
 * @param {string} path
 */
export function orgAppPath(path = '/dashboard') {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `/${DEFAULT_ORG_SLUG}${suffix}`;
}

/** Visible Clerk sign-in surface (excludes hidden GoogleOneTap). */
export function clerkLoginSurface(page) {
  return page
    .locator(
      '[data-clerk-component]:not([data-clerk-component="GoogleOneTap"]), .cl-signIn-root, .cl-rootBox, iframe[title*="Clerk" i], input[autocomplete="username"]',
    )
    .or(page.getByText(/Clerk is not configured/i));
}
