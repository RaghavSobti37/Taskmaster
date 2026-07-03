/**
 * Client Sentry — optional; no-op when VITE_SENTRY_DSN unset.
 */
let Sentry = null;
let initialized = false;

export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn || initialized) return false;

  try {
    const mod = await import('@sentry/react');
    Sentry = mod;
    mod.init({
      dsn,
      environment: import.meta.env.MODE || 'development',
      release: `coreknot-web@${import.meta.env.VITE_APP_VERSION || '1.0.7'}`,
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
      sendDefaultPii: false,
    });
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export function getSentry() {
  return Sentry;
}
