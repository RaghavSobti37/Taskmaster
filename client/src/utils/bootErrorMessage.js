/** User-facing copy for auth/bootstrap failures (not 401 logged-out). */
export function formatBootError(err) {
  const status = err?.status;
  const message = String(err?.message || '').trim();
  const capturedAt = Date.now();

  if (status === 502 || status === 503 || status === 504) {
    return {
      summary: 'This page could not load because the server did not respond. This usually resolves in under a minute.',
      statusCode: status,
      error: err instanceof Error ? err : new Error(message || `HTTP ${status}`),
      capturedAt,
      showHealthyBadge: true,
    };
  }
  if (err?.code === 'TIMEOUT' || /timed out/i.test(message)) {
    return {
      summary: 'Connection timed out. Check your network and try again.',
      statusCode: status || null,
      error: err instanceof Error ? err : new Error(message || 'Connection timed out'),
      capturedAt,
    };
  }
  return {
    summary: "Could not reach CoreKnot. Check your connection and try again.",
    statusCode: status || null,
    error: err instanceof Error ? err : new Error(message || 'Boot failed'),
    capturedAt,
  };
}

/** @deprecated string — prefer formatBootError for structured boot errors */
export function formatBootErrorMessage(err) {
  return formatBootError(err).summary;
}
