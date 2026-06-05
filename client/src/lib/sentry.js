let initialized = false;

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn || initialized) return false;

  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        release: import.meta.env.VITE_SENTRY_RELEASE,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) || 0.1,
      });
      initialized = true;
    })
    .catch(() => {
      /* optional dependency */
    });

  return true;
};

export const isSentryEnabled = () => initialized;
