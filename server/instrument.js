/**
 * Sentry instrumentation — must load before Express app.
 */
const Sentry = require('@sentry/node');
const { readFileSync } = require('fs');
const { join } = require('path');

const dsn = String(process.env.SENTRY_DSN || '').trim();
let release = process.env.SENTRY_RELEASE || process.env.RENDER_GIT_COMMIT || '';

if (!release) {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    release = `coreknot-api@${pkg.version || '0.0.0'}`;
  } catch {
    release = 'coreknot-api@unknown';
  }
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    sendDefaultPii: false,
  });
}

module.exports = { Sentry, sentryEnabled: Boolean(dsn) };
