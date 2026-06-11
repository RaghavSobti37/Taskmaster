/**
 * Observability bootstrap — Datadog + Sentry initialized from server entry.
 */
module.exports = {
  datadogInit: require('../../datadog-init'),
  sentry: require('../../utils/sentry'),
};
