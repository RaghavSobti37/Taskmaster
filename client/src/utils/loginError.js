/** Map login API failures to user-facing copy (mobile proxy vs credential vs rate limit). */
export function formatLoginError(err) {
  if (!err?.response) {
    return {
      message:
        'Could not reach the server. Check your connection, or tap Clear session cookies below and try again.',
      isNetwork: true,
    };
  }

  const status = err.response.status;
  const data = err.response.data;
  const serverError = data?.error || data?.message;

  if (serverError) {
    return { message: serverError, isNetwork: false };
  }

  if (status === 429) {
    return { message: 'Too many login attempts. Please try again in 15 minutes.', isNetwork: false };
  }

  if (status === 404 || status === 502 || status === 503 || status === 504) {
    return {
      message:
        'Login service unavailable (server proxy error). Try Clear session cookies, then sign in again. If this persists, reinstall the app shortcut.',
      isNetwork: true,
    };
  }

  if (status === 401 || status === 403) {
    return { message: 'Invalid email or password.', isNetwork: false };
  }

  return {
    message: 'Authentication failed. Please check your credentials.',
    isNetwork: false,
  };
}
