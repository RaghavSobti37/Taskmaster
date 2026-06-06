/**
 * Datadog APM — must load before any other application modules.
 * Set DD_API_KEY + DD_SERVICE in Render to enable.
 */
if (process.env.DD_API_KEY?.trim() && process.env.NODE_ENV !== 'test') {
  try {
    // eslint-disable-next-line global-require
    require('dd-trace').init({
      service: process.env.DD_SERVICE || 'coreknot-api',
      env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
      version: process.env.DD_VERSION || process.env.RENDER_GIT_COMMIT || undefined,
      logInjection: true,
      runtimeMetrics: true,
      profiling: process.env.DD_PROFILING_ENABLED === 'true',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[Datadog] APM init skipped:', err.message);
  }
}
