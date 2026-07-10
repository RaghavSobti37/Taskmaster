const crypto = require('crypto');
const TenantWebhook = require('../models/TenantWebhook');
const WebhookDeliveryLog = require('../domains/integrations-hub/models/WebhookDeliveryLog');
const { hashSecret, encryptSecret, decryptSecret } = require('../utils/credentialEncryption');
const { TENANT_WEBHOOK_EVENTS } = require('../config/integrationProviders.config');

function generateWebhookSecret() {
  const raw = crypto.randomBytes(24).toString('base64url');
  return { secret: `whsec_${raw}`, prefix: `whsec_${raw.slice(0, 8)}` };
}

async function createTenantWebhook({ tenantId, url, events, createdBy }) {
  const { secret, prefix } = generateWebhookSecret();
  const validEvents = (events || ['lead.created']).filter((e) => TENANT_WEBHOOK_EVENTS.includes(e));
  const doc = await TenantWebhook.create({
    tenantId,
    url,
    events: validEvents.length ? validEvents : ['lead.created'],
    secretHash: hashSecret(secret),
    secretEncrypted: encryptSecret(secret),
    secretPrefix: prefix,
    createdBy,
  });
  return { webhook: doc, secret };
}

async function logDelivery({
  tenantId, webhookId, event, url, statusCode, success, error, payloadPreview, durationMs, attempt = 1,
}) {
  try {
    await WebhookDeliveryLog.create({
      tenantId,
      webhookId,
      event,
      url,
      statusCode,
      success,
      error,
      payloadPreview: payloadPreview?.slice?.(0, 2000),
      durationMs,
      attempt,
    });
  } catch {
    // ponytail: delivery must not block dispatch
  }
}

async function deliverHook(hook, event, body, tenantId, attempt = 1) {
  const started = Date.now();
  try {
    const signingKey = decryptSecret(hook.secretEncrypted) || '';
    const sig = crypto.createHmac('sha256', signingKey).update(body).digest('hex');
    const res = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CoreKnot-Signature': sig,
        'X-CoreKnot-Event': event,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });
    const durationMs = Date.now() - started;
    hook.lastDeliveryAt = new Date();
    hook.lastStatus = res.status;
    if (!res.ok) hook.failureCount = (hook.failureCount || 0) + 1;
    await hook.save();
    await logDelivery({
      tenantId,
      webhookId: hook._id,
      event,
      url: hook.url,
      statusCode: res.status,
      success: res.ok,
      payloadPreview: body,
      durationMs,
      attempt,
    });
    return { url: hook.url, status: res.status, success: res.ok };
  } catch (err) {
    hook.failureCount = (hook.failureCount || 0) + 1;
    hook.lastStatus = 0;
    await hook.save();
    await logDelivery({
      tenantId,
      webhookId: hook._id,
      event,
      url: hook.url,
      statusCode: 0,
      success: false,
      error: err.message,
      payloadPreview: body,
      durationMs: Date.now() - started,
      attempt,
    });
    return { url: hook.url, error: err.message, success: false, hookId: hook._id, body, event };
  }
}

async function dispatchTenantWebhook(tenantId, event, payload) {
  const hooks = await TenantWebhook.find({ tenantId, active: true, events: event })
    .setOptions({ bypassTenant: true })
    .select('+secretEncrypted url');
  if (!hooks.length) return [];
  const body = JSON.stringify({ event, tenantId: String(tenantId), data: payload, sentAt: new Date().toISOString() });
  const results = [];
  const failures = [];
  for (const hook of hooks) {
    const result = await deliverHook(hook, event, body, tenantId);
    results.push(result);
    if (!result.success) failures.push(result);
  }
  if (failures.length) {
    setImmediate(() => {
      retryFailedDeliveries(tenantId, failures, 2).catch(() => {});
    });
  }
  return results;
}

async function retryFailedDeliveries(tenantId, failures, maxAttempt = 3) {
  for (const fail of failures) {
    if (!fail.hookId) continue;
    const hook = await TenantWebhook.findById(fail.hookId)
      .select('+secretEncrypted url')
      .setOptions({ bypassTenant: true });
    if (!hook?.active) continue;
    for (let attempt = 2; attempt <= maxAttempt; attempt += 1) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      const result = await deliverHook(hook, fail.event, fail.body, tenantId, attempt);
      if (result.success) break;
    }
  }
}

async function listDeliveryLogs(tenantId, { limit = 50, webhookId } = {}) {
  const q = { tenantId };
  if (webhookId) q.webhookId = webhookId;
  return WebhookDeliveryLog.find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .setOptions({ bypassTenant: true })
    .lean();
}

module.exports = {
  TENANT_WEBHOOK_EVENTS,
  generateWebhookSecret,
  createTenantWebhook,
  dispatchTenantWebhook,
  listDeliveryLogs,
};
