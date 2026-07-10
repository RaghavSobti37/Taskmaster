const TenantIntegration = require('../models/TenantIntegration');
const { unpackCredentials } = require('./integrationCredentialService');
const { bypassOptions } = require('../../../infrastructure/database/bypassTenantPolicy');

const LOOKUP_BYPASS = bypassOptions('aisensy_integration_lookup');

function publicApiBase() {
  return (process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
}

function webhookUrl() {
  const base = publicApiBase();
  return base ? `${base}/api/webhooks/aisensy` : '/api/webhooks/aisensy';
}

function normalizeHeaderSecret(header) {
  if (!header) return '';
  const raw = String(header).trim();
  if (raw.toLowerCase().startsWith('bearer ')) return raw.slice(7).trim();
  return raw;
}

async function listAisensyIntegrations() {
  return TenantIntegration.find({ provider: 'aisensy', status: 'connected' })
    .select('+credentialsEncrypted tenantId metadata')
    .setOptions(LOOKUP_BYPASS);
}

async function resolveAisensyCredentials(tenantId) {
  if (!tenantId) return null;
  const doc = await TenantIntegration.findOne({ tenantId, provider: 'aisensy', status: 'connected' })
    .select('+credentialsEncrypted metadata')
    .setOptions(LOOKUP_BYPASS);
  if (!doc?.credentialsEncrypted) return null;
  const credentials = unpackCredentials(doc.credentialsEncrypted);
  const metadata = doc.metadata || {};
  return {
    apiKey: credentials.apiKey,
    defaultCampaign: metadata.defaultCampaign || process.env.AISENSY_DEFAULT_CAMPAIGN || '',
    integrationId: doc._id,
  };
}

async function resolveTenantByWebhookSecret(headerValue) {
  const secret = normalizeHeaderSecret(headerValue);
  if (!secret) return null;
  const envSecret = (process.env.AISENSY_WEBHOOK_SECRET || '').trim();
  if (envSecret && secret === envSecret) {
    const Tenant = require('../../../models/Tenant');
    const tenant = await Tenant.findOne({}).select('_id').setOptions(LOOKUP_BYPASS).lean();
    return tenant?._id ?? null;
  }
  const rows = await listAisensyIntegrations();
  for (const row of rows) {
    const credentials = unpackCredentials(row.credentialsEncrypted);
    if (credentials.webhookSecret && credentials.webhookSecret === secret) {
      return row.tenantId;
    }
  }
  return null;
}

async function resolveTenantByVerifyToken(token) {
  const received = String(token || '').replace(/['"]/g, '').trim();
  if (!received) return null;
  const envExpected = (
    process.env.AISENSY_WEBHOOK_VERIFY_TOKEN
    || process.env.META_VERIFY_TOKEN
    || process.env.META_WEBHOOK_VERIFY_TOKEN
    || ''
  ).replace(/['"]/g, '').trim();
  if (envExpected && received === envExpected) {
    const Tenant = require('../../../models/Tenant');
    const tenant = await Tenant.findOne({}).select('_id').setOptions(LOOKUP_BYPASS).lean();
    return tenant?._id ?? null;
  }
  const rows = await listAisensyIntegrations();
  for (const row of rows) {
    const credentials = unpackCredentials(row.credentialsEncrypted);
    if (credentials.webhookVerifyToken && credentials.webhookVerifyToken === received) {
      return row.tenantId;
    }
  }
  return null;
}

module.exports = {
  publicApiBase,
  webhookUrl,
  resolveAisensyCredentials,
  resolveTenantByWebhookSecret,
  resolveTenantByVerifyToken,
};
