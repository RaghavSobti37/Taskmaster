/**
 * Resolve Clerk session JWT for clerk-establish after sign-in (incl. client-trust OTP).
 * Pins org when configured; retries when Clerk session is not ready yet.
 */
export async function fetchClerkEstablishToken({
  getToken,
  setActive,
  pinnedOrgId,
  activeOrgId,
  clientOrgScope = true,
}) {
  if (clientOrgScope && pinnedOrgId && activeOrgId !== pinnedOrgId) {
    try {
      await setActive({ organization: pinnedOrgId });
    } catch {
      // ponytail: server pins org via CLERK_ORGANIZATION_ID — still try session JWT below
    }
  }

  let token = null;
  try {
    if (clientOrgScope && pinnedOrgId) {
      token = await getToken({ organizationId: pinnedOrgId });
    }
    if (!token) {
      token = await getToken();
    }
  } catch (err) {
    const status = err?.status || err?.response?.status;
    return {
      ok: false,
      retryable: status !== 401 && status !== 403,
      error: {
        status,
        message: err?.message || 'Clerk session token could not be read.',
      },
      code: status === 401 || status === 403 ? 'clerk-session-stale' : 'clerk-token-error',
    };
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
