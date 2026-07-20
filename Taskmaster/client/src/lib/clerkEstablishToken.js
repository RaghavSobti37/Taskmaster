/**
 * Resolve Clerk session JWT for clerk-establish after sign-in (incl. client-trust OTP).
 * Active Clerk org wins; pinned env is fallback only when no org is selected.
 */
export async function fetchClerkEstablishToken({
  getToken,
  setActive,
  pinnedOrgId,
  activeOrgId,
  clientOrgScope = true,
}) {
  const targetOrgId = String(activeOrgId || pinnedOrgId || '').trim();

  if (clientOrgScope && targetOrgId && activeOrgId !== targetOrgId) {
    try {
      await setActive({ organization: targetOrgId });
    } catch {
      // ponytail: establish still tries org-scoped JWT below
    }
  }

  let token = null;
  try {
    if (clientOrgScope && targetOrgId) {
      token = await getToken({ organizationId: targetOrgId });
    }
    if (!token) {
      token = await getToken();
    }
  } catch (err) {
    const status = err?.status || err?.response?.status;
    const first = err?.errors?.[0] || {};
    const code = first.code || err?.code || (status === 401 || status === 403 ? 'clerk-session-stale' : 'clerk-token-error');
    const terminalAuthError = status === 401 || status === 403 || code === 'authorization_invalid';
    const message = first.longMessage
      || first.long_message
      || first.message
      || err?.message
      || 'Clerk session token could not be read.';
    const trace = err?.clerk_trace_id ? ` trace ${err.clerk_trace_id}` : '';
    return {
      ok: false,
      retryable: !terminalAuthError,
      error: {
        status,
        message: trace ? `${message} (${code};${trace})` : message,
      },
      code,
    };
  }

  if (!token) {
    return {
      ok: false,
      retryable: true,
      error: { message: 'Clerk session not ready after sign-in.' },
    };
  }

  return { ok: true, token, organizationId: clientOrgScope ? (targetOrgId || null) : null };
}
