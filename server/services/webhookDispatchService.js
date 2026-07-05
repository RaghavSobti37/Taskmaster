const crypto = require('crypto');
const TenantWebhook = require('../models/TenantWebhook');
const { hashSecret, encryptSecret, decryptSecret } = require('../utils/credentialEncryption');

function generateWebhookSecret() {
  const raw = crypto.randomBytes(24).toString('base64url');
  return { secret: `whsec_${raw}`, prefix: `whsec_${raw.slice(0, 8)}` };
}

async function createTenantWebhook({ tenantId, url, events, createdBy }) {
  const { secret, prefix } = generateWebhookSecret();
  const doc = await TenantWebhook.create({
    tenantId,
    url,
    events: events || ['lead.created'],
    secretHash: hashSecret(secret),
    secretEncrypted: encryptSecret(secret),
    secretPrefix: prefix,
    createdBy,
  });
  return { webhook: doc, secret };
}

async function dispatchTenantWebhook(tenantId, event, payload) {
  const hooks = await TenantWebhook.find({ tenantId, active: true, events: event })
    .setOptions({ bypassTenant: true })
    .select('+secretEncrypted url');
  if (!hooks.length) return [];
  const body = JSON.stringify({ event, tenantId: String(tenantId), data: payload, sentAt: new Date().toISOString() });
  const results = [];
  for (const hook of hooks) {
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
      hook.lastDeliveryAt = new Date();
      hook.lastStatus = res.status;
      if (!res.ok) hook.failureCount = (hook.failureCount || 0) + 1;
      await hook.save();
      results.push({ url: hook.url, status: res.status });
    } catch (err) {
      hook.failureCount = (hook.failureCount || 0) + 1;
      hook.lastStatus = 0;
      await hook.save();
      results.push({ url: hook.url, error: err.message });
    }
  }
  return results;
}

module.exports = {
  createTenantWebhook,
  dispatchTenantWebhook,
};
