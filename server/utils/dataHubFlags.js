/**
 * Data Hub runtime flags — local dev should disable auto-reconcile when CRM data is purged.
 */

function readBool(name, defaultValue) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return defaultValue;
}

/** Auto reconcile + inlet merge (default: on in production, off in development). */
function isDataHubReconcileEnabled() {
  return readBool(
    'DATA_HUB_RECONCILE_ENABLED',
    process.env.NODE_ENV === 'production'
  );
}

function getDataHubRuntimeFlags() {
  const reconcileEnabled = isDataHubReconcileEnabled();
  const localDevMode = process.env.NODE_ENV !== 'production' && !reconcileEnabled;
  return {
    reconcileEnabled,
    localDevMode,
    message: localDevMode
      ? 'Local dev — CRM/person data not synced. Data Hub shows operational test data only.'
      : undefined,
  };
}

module.exports = {
  isDataHubReconcileEnabled,
  getDataHubRuntimeFlags,
};
