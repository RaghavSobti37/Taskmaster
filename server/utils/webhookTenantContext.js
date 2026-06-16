const { resolveDefaultTenantId } = require('./defaultTenant');
const { runWithWorkerTenant } = require('./workerTenantContext');

/** Run webhook/cron logic with explicit default-tenant AsyncLocalStorage context. */
async function runWithDefaultWebhookTenant(fn) {
  const tenantId = await resolveDefaultTenantId();
  return runWithWorkerTenant(tenantId, fn);
}

module.exports = {
  runWithDefaultWebhookTenant,
};
