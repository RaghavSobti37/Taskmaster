const crypto = require('crypto');
const TenantIntegration = require('../models/TenantIntegration');
const Tenant = require('../../../models/Tenant');
const { byProviderId, INTEGRATION_PROVIDERS } = require('../../../config/integrationProviders.config');
const { getAdapter } = require('../adapters/adapterRegistry');
const { packCredentials, unpackCredentials } = require('./integrationCredentialService');
const {
  signIntegrationOAuthState,
  integrationCallbackUri,
  buildOAuthUrl,
} = require('./oauthService');
const { planAllowsFeature } = require('../../../../shared/planLimits');
const { recordAuditEvent } = require('../../../services/auditEventService');
const webhookInAdapter = require('../adapters/webhookInAdapter');

async function markIntegrationsOnboardingStep(tenantId) {
  try {
    const Tenant = require('../../../models/Tenant');
    const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true });
    if (!tenant) return;
    tenant.onboardingProgress = tenant.onboardingProgress || { completedSteps: [] };
    const steps = tenant.onboardingProgress.completedSteps || [];
    if (!steps.includes('integrations_connected')) {
      steps.push('integrations_connected');
      tenant.onboardingProgress.completedSteps = steps;
      await tenant.save();
    }
  } catch {
    // non-blocking
  }
}

function serializeConnection(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    _id: o._id,
    provider: o.provider,
    category: o.category,
    label: o.label,
    status: o.status,
    authType: o.authType,
    externalAccountId: o.externalAccountId,
    scopes: o.scopes,
    capabilities: o.capabilities,
    metadata: o.metadata,
    lastSyncAt: o.lastSyncAt,
    lastError: o.lastError,
    tokenExpiresAt: o.tokenExpiresAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

async function assertPlanForProvider(tenantId, providerConfig) {
  const tenant = await Tenant.findById(tenantId).select('plan').setOptions({ bypassTenant: true });
  const plan = tenant?.plan || 'free';
  if (providerConfig.planMin === 'enterprise' && plan !== 'enterprise') {
    const err = new Error('This integration requires an enterprise plan');
    err.status = 402;
    err.code = 'PLAN_UPGRADE_REQUIRED';
    throw err;
  }
  if (providerConfig.planMin === 'pro' && !['pro', 'enterprise'].includes(plan)) {
    const err = new Error('This integration requires a pro plan or higher');
    err.status = 402;
    err.code = 'PLAN_UPGRADE_REQUIRED';
    throw err;
  }
  if (providerConfig.featureUnlock && !planAllowsFeature(plan, providerConfig.featureUnlock)) {
    const err = new Error('Feature not unlocked for this organization');
    err.status = 403;
    err.code = 'FEATURE_LOCKED';
    throw err;
  }
}

async function listProvidersWithStatus(tenantId) {
  const connections = await TenantIntegration.find({ tenantId })
    .setOptions({ bypassTenant: true })
    .lean();
  const byProvider = new Map(connections.map((c) => [c.provider, c]));
  return INTEGRATION_PROVIDERS.map((p) => {
    const conn = byProvider.get(p.id);
    return {
      ...p,
      connection: conn ? serializeConnection(conn) : null,
      connected: conn?.status === 'connected',
    };
  });
}

async function listConnections(tenantId) {
  const rows = await TenantIntegration.find({ tenantId }).setOptions({ bypassTenant: true });
  return rows.map(serializeConnection);
}

async function getCredentials(integrationId, tenantId) {
  const doc = await TenantIntegration.findOne({ _id: integrationId, tenantId })
    .select('+credentialsEncrypted')
    .setOptions({ bypassTenant: true });
  if (!doc) return null;
  return unpackCredentials(doc.credentialsEncrypted);
}

async function saveConnection({
  tenantId,
  providerConfig,
  credentials,
  userId,
  label,
  metadata = {},
  externalAccountId,
  scopes,
  tokenExpiresAt,
}) {
  const packed = packCredentials(credentials);
  const filter = {
    tenantId,
    provider: providerConfig.id,
    externalAccountId: externalAccountId || credentials.accountId || providerConfig.id,
  };
  const doc = await TenantIntegration.findOneAndUpdate(
    filter,
    {
      $set: {
        category: providerConfig.category,
        label: label || providerConfig.name,
        status: 'connected',
        authType: providerConfig.authType,
        credentialsEncrypted: packed,
        scopes: scopes || providerConfig.oauthConfig?.scopes || [],
        externalAccountId: filter.externalAccountId,
        capabilities: providerConfig.capabilities,
        metadata: { ...metadata, email: credentials.email },
        lastError: null,
        tokenExpiresAt: tokenExpiresAt || null,
        createdBy: userId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).setOptions({ bypassTenant: true });
  return doc;
}

async function initiateOAuth({ tenantId, provider, userId, req, returnUrl }) {
  const providerConfig = byProviderId(provider);
  if (!providerConfig || providerConfig.authType !== 'oauth2') {
    const err = new Error('Provider does not support OAuth');
    err.status = 400;
    throw err;
  }
  await assertPlanForProvider(tenantId, providerConfig);
  const adapter = getAdapter(provider);
  if (!adapter) {
    const err = new Error('Adapter not found');
    err.status = 400;
    throw err;
  }
  const { clientId } = adapter.getClientCreds?.() || {};
  if (!clientId) {
    const err = new Error(`OAuth not configured for ${provider}`);
    err.status = 503;
    throw err;
  }
  const state = signIntegrationOAuthState({ tenantId, provider, userId, returnUrl });
  const redirectUri = integrationCallbackUri(req, provider);
  const extraParams = {};
  if (provider === 'gmail' || provider === 'google_sheets') {
    extraParams.access_type = 'offline';
    extraParams.prompt = 'consent';
  }
  const authUrl = buildOAuthUrl(providerConfig, { clientId, redirectUri, state, extraParams });
  return { authUrl, state };
}

async function handleOAuthCallback({ provider, code, state, req }) {
  const { verifyIntegrationOAuthState, integrationCallbackUri: callbackUri } = require('./oauthService');
  const payload = verifyIntegrationOAuthState(state);
  if (payload.provider !== provider) throw new Error('Provider mismatch');
  const providerConfig = byProviderId(provider);
  const adapter = getAdapter(provider);
  if (!adapter?.handleCallback) throw new Error('Adapter missing handleCallback');
  const redirectUri = callbackUri(req, provider);
  const credentials = await adapter.handleCallback({ code, redirectUri });
  const doc = await saveConnection({
    tenantId: payload.tenantId,
    providerConfig,
    credentials,
    userId: payload.userId,
    externalAccountId: credentials.accountId,
    scopes: credentials.scopes,
    tokenExpiresAt: credentials.expiresAt,
  });
  await recordAuditEvent({
    tenantId: payload.tenantId,
    actorId: payload.userId,
    action: 'integration.connected',
    resourceType: 'tenantIntegration',
    resourceId: doc._id,
    after: { provider, accountId: credentials.accountId },
    req,
  });
  await markIntegrationsOnboardingStep(payload.tenantId);
  return { integration: serializeConnection(doc), returnUrl: payload.returnUrl };
}

async function connectWithApiKey({ tenantId, provider, apiKey, userId, req, label }) {
  const providerConfig = byProviderId(provider);
  if (!providerConfig) {
    const err = new Error('Unknown provider');
    err.status = 400;
    throw err;
  }
  if (providerConfig.authType !== 'api_key') {
    const err = new Error('Provider does not accept API keys');
    err.status = 400;
    throw err;
  }
  await assertPlanForProvider(tenantId, providerConfig);
  const adapter = getAdapter(provider);
  if (!adapter?.handleApiKeyConnect) {
    const err = new Error('API key connect not supported');
    err.status = 400;
    throw err;
  }
  const credentials = await adapter.handleApiKeyConnect({ apiKey });
  const doc = await saveConnection({
    tenantId,
    providerConfig,
    credentials,
    userId,
    label,
    externalAccountId: credentials.accountId,
  });
  await recordAuditEvent({
    tenantId,
    actorId: userId,
    action: 'integration.connected',
    resourceType: 'tenantIntegration',
    resourceId: doc._id,
    after: { provider, authType: 'api_key' },
    req,
  });
  await markIntegrationsOnboardingStep(tenantId);
  return serializeConnection(doc);
}

async function provisionWebhookIn({ tenantId, userId, req, label }) {
  const providerConfig = byProviderId('webhook_in');
  await assertPlanForProvider(tenantId, providerConfig);
  const { secret, prefix } = webhookInAdapter.generateWebhookSecret();
  const integrationId = new TenantIntegration()._id;
  const tenant = await Tenant.findById(tenantId).select('slug').setOptions({ bypassTenant: true });
  const slug = tenant?.slug || String(tenantId);
  const inboundPath = `/api/integrations/webhooks/inbound/${slug}/${integrationId}`;
  const credentials = { webhookSecret: secret, secretPrefix: prefix };
  const doc = await TenantIntegration.create({
    _id: integrationId,
    tenantId,
    provider: 'webhook_in',
    category: 'custom',
    label: label || 'Inbound Webhook',
    status: 'connected',
    authType: 'webhook_secret',
    credentialsEncrypted: packCredentials(credentials),
    externalAccountId: String(integrationId),
    capabilities: providerConfig.capabilities,
    metadata: { inboundPath, secretPrefix: prefix },
    createdBy: userId,
  });
  await recordAuditEvent({
    tenantId,
    actorId: userId,
    action: 'integration.connected',
    resourceType: 'tenantIntegration',
    resourceId: doc._id,
    after: { provider: 'webhook_in' },
    req,
  });
  return { connection: serializeConnection(doc), secret, inboundPath };
}

async function disconnectConnection({ integrationId, tenantId, userId, req }) {
  const doc = await TenantIntegration.findOne({ _id: integrationId, tenantId })
    .setOptions({ bypassTenant: true });
  if (!doc) {
    const err = new Error('Integration not found');
    err.status = 404;
    throw err;
  }
  await TenantIntegration.deleteOne({ _id: integrationId, tenantId }).setOptions({ bypassTenant: true });
  await recordAuditEvent({
    tenantId,
    actorId: userId,
    action: 'integration.disconnected',
    resourceType: 'tenantIntegration',
    resourceId: integrationId,
    before: { provider: doc.provider },
    req,
  });
  return { success: true };
}

async function runHealthCheck({ integrationId, tenantId }) {
  const doc = await TenantIntegration.findOne({ _id: integrationId, tenantId })
    .select('+credentialsEncrypted')
    .setOptions({ bypassTenant: true });
  if (!doc) {
    const err = new Error('Integration not found');
    err.status = 404;
    throw err;
  }
  const adapter = getAdapter(doc.provider);
  const credentials = unpackCredentials(doc.credentialsEncrypted);
  try {
    const result = adapter?.healthCheck ? await adapter.healthCheck(credentials) : { ok: true };
    doc.status = 'connected';
    doc.lastError = null;
    await doc.save();
    return result;
  } catch (err) {
    doc.status = 'error';
    doc.lastError = err.message;
    await doc.save();
    const { emitTenantEvent } = require('../../../services/enterpriseWebhook');
    emitTenantEvent(tenantId, 'integration.error', {
      provider: doc.provider,
      integrationId: String(doc._id),
      error: err.message,
    });
    throw err;
  }
}

async function refreshExpiringTokens() {
  const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const rows = await TenantIntegration.find({
    status: 'connected',
    authType: 'oauth2',
    tokenExpiresAt: { $lte: soon, $ne: null },
  })
    .select('+credentialsEncrypted tenantId provider')
    .setOptions({ bypassTenant: true });
  let refreshed = 0;
  for (const doc of rows) {
    const adapter = getAdapter(doc.provider);
    if (!adapter?.refreshToken) continue;
    try {
      const credentials = unpackCredentials(doc.credentialsEncrypted);
      const updated = await adapter.refreshToken(credentials);
      doc.credentialsEncrypted = packCredentials(updated);
      doc.tokenExpiresAt = updated.expiresAt || doc.tokenExpiresAt;
      doc.status = 'connected';
      doc.lastError = null;
      await doc.save();
      refreshed += 1;
    } catch (err) {
      doc.status = 'reauth_required';
      doc.lastError = err.message;
      await doc.save();
    }
  }
  return { refreshed, checked: rows.length };
}

async function getConnectedIntegration(tenantId, provider) {
  return TenantIntegration.findOne({ tenantId, provider, status: 'connected' })
    .select('+credentialsEncrypted')
    .setOptions({ bypassTenant: true });
}

module.exports = {
  serializeConnection,
  listProvidersWithStatus,
  listConnections,
  getCredentials,
  initiateOAuth,
  handleOAuthCallback,
  connectWithApiKey,
  provisionWebhookIn,
  disconnectConnection,
  runHealthCheck,
  refreshExpiringTokens,
  getConnectedIntegration,
  saveConnection,
  assertPlanForProvider,
};
