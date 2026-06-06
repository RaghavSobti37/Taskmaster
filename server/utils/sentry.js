let initialized = false;

const getSentry = () => {
  if (!initialized) return null;
  try {
    return require('@sentry/node');
  } catch {
    return null;
  }
};

const initSentry = () => {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || initialized) return false;

  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || process.env.RENDER_GIT_COMMIT || undefined,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    });
    initialized = true;
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[Sentry] Init skipped:', err.message);
    return false;
  }
};

const setupSentryExpress = (app) => {
  const Sentry = getSentry();
  if (!Sentry || !app) return;
  try {
    Sentry.setupExpressErrorHandler(app);
  } catch {
    /* optional */
  }
};

const captureException = (error, context = {}) => {
  const Sentry = getSentry();
  if (!Sentry) return;
  try {
    Sentry.captureException(error, { extra: context });
  } catch {
    /* optional */
  }
};

const setSentryUser = (user) => {
  const Sentry = getSentry();
  if (!Sentry || !user) return;
  try {
    Sentry.setUser({
      id: String(user._id || user.id || ''),
      email: user.email || undefined,
      username: user.name || user.username || undefined,
    });
  } catch {
    /* optional */
  }
};

const clearSentryUser = () => {
  const Sentry = getSentry();
  if (!Sentry) return;
  try {
    Sentry.setUser(null);
  } catch {
    /* optional */
  }
};

module.exports = {
  initSentry,
  setupSentryExpress,
  captureException,
  setSentryUser,
  clearSentryUser,
  isSentryEnabled: () => initialized,
};
