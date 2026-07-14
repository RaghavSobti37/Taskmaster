/**
 * Decide whether a Clerk session on the auth host is stale enough to sign out.
 * Null/undefined tokens are normal right after password submit while JWT warms —
 * signing out there races clerk-establish and kicks the user back to SignIn.
 */
export function shouldSignOutStaleClerkSession({ token, error } = {}) {
  if (token) return false;
  const status = error?.status || error?.response?.status;
  return status === 401 || status === 403;
}
