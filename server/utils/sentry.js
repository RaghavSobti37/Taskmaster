let initialized = false;

const initSentry = () => {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || initialized) return false;

  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
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
  if (!initialized || !app) return;
  try {
    const Sentry = require('@sentry/node');
    Sentry.setupExpressErrorHandler(app);
  } catch {
    /* optional */
  }
};

const captureException = (error, context = {}) => {
  if (!initialized) return;
  try {
    const Sentry = require('@sentry/node');
    Sentry.captureException(error, { extra: context });
  } catch {
    /* optional */
  }
};

module.exports = {
  initSentry,
  setupSentryExpress,
  captureException,
  isEnabled: () => initialized,
};
