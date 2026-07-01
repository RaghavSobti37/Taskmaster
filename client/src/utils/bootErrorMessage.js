/** User-facing copy for auth/bootstrap failures (not 401 logged-out). */
export function formatBootErrorMessage(err) {
  const status = err?.status;
  if (status === 502 || status === 503 || status === 504) {
    return 'Server is temporarily unavailable. Refresh in a minute or contact your admin.';
  }
  if (err?.code === 'TIMEOUT' || /timed out/i.test(String(err?.message || ''))) {
    return 'Connection timed out. Check your network and refresh.';
  }
  return "Couldn't reach CoreKnot. Check your connection and refresh.";
}
