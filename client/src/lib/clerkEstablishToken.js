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
    } catch (err) {
      const clerkMessage = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message;
      return {
        ok: false,
        retryable: false,
        error: {
          message: clerkMessage
            || err?.message
            || 'Could not open your organization workspace. Ask an admin for an invitation.',
        },
      };
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
