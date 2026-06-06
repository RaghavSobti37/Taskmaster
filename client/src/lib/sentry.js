let initialized = false;
let SentryModule = null;

const loadSentry = async () => {
  if (SentryModule) return SentryModule;
  try {
    SentryModule = await import('@sentry/react');
    return SentryModule;
  } catch {
    return null;
  }
};

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn || initialized) return false;

  loadSentry()
    .then((Sentry) => {
      if (!Sentry) return;
      Sentry.init({
        dsn,
        environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
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

export const captureException = (error, context = {}) => {
  if (!initialized) return;
  loadSentry()
    .then((Sentry) => {
      if (!Sentry) return;
      Sentry.captureException(error, { extra: context });
    })
    .catch(() => {});
};

export const setSentryUser = (user) => {
  if (!initialized || !user) return;
  loadSentry()
    .then((Sentry) => {
      if (!Sentry) return;
      Sentry.setUser({
        id: String(user._id || user.id || ''),
        email: user.email || undefined,
        username: user.name || user.username || undefined,
      });
    })
    .catch(() => {});
};

export const clearSentryUser = () => {
  if (!initialized) return;
  loadSentry()
    .then((Sentry) => {
      if (!Sentry) return;
      Sentry.setUser(null);
    })
    .catch(() => {});
};
