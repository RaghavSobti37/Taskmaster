/**
 * Resolve Clerk session JWT for clerk-establish after sign-in (incl. client-trust OTP).
 * Pins org when configured; retries when Clerk session is not ready yet.
 */
export async function fetchClerkEstablishToken({
  getToken,
  setActive,
  pinnedOrgId,
  activeOrgId,
}) {
  if (pinnedOrgId && activeOrgId !== pinnedOrgId) {
    try {
      await setActive({ organization: pinnedOrgId });
    } catch {
      // ponytail: server pins org via CLERK_ORGANIZATION_ID — still try session JWT below
    }
  }

  let token = null;
  if (pinnedOrgId) {
    token = await getToken({ organizationId: pinnedOrgId });
  }
  if (!token) {
    token = await getToken();
  }

  if (!token) {
    return {
      ok: false,
      retryable: true,
      error: { message: 'Clerk session not ready after sign-in.' },
    };
  }

  return { ok: true, token };
}
