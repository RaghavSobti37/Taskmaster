const { dispatchTenantWebhook } = require('./webhookDispatchService');

/** Fire-and-forget tenant webhook — never block request path. */
function emitTenantEvent(tenantId, event, payload) {
  if (!tenantId) return;
  setImmediate(() => {
    dispatchTenantWebhook(tenantId, event, payload).catch(() => {});
  });
}

module.exports = { emitTenantEvent };
