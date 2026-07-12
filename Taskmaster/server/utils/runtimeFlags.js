/** ponytail: one switch — skip in-process cron + tight health poll loops. */
const truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

function isLightweightMode() {
  return truthy(process.env.COREKNOT_LIGHTWEIGHT);
}

/** In-process node-cron schedulers (stats, notifications, supabase sync, …). */
function cronJobsEnabled() {
  if (isLightweightMode()) return false;
  if (truthy(process.env.COREKNOT_DISABLE_CRON)) return false;
  return true;
}

/** backgroundQueue setInterval analytics/offboarding loops. */
function backgroundIntervalsEnabled() {
  if (isLightweightMode()) return false;
  if (truthy(process.env.COREKNOT_DISABLE_BACKGROUND_INTERVALS)) return false;
  return true;
}

/** SystemHealthService dependency probe loop. */
function healthProbeLoopEnabled() {
  if (isLightweightMode()) return false;
  if (truthy(process.env.COREKNOT_DISABLE_HEALTH_PROBE_LOOP)) return false;
  return true;
}

module.exports = {
  isLightweightMode,
  cronJobsEnabled,
  backgroundIntervalsEnabled,
  healthProbeLoopEnabled,
};
