const crypto = require('crypto');
const Tenant = require('../../../models/Tenant');
const TenantIntegration = require('../models/TenantIntegration');
const { unpackCredentials } = require('./integrationCredentialService');
const webhookInAdapter = require('../adapters/webhookInAdapter');
const User = require('../../../models/User');
const { createLead } = require('../../crm/services/leadWriteService');
const logger = require('../../../utils/logger');

async function resolveInboundIntegration(tenantSlug, integrationId) {
  const tenant = await Tenant.findOne({ slug: tenantSlug }).setOptions({ bypassTenant: true });
  if (!tenant) return null;
  const doc = await TenantIntegration.findOne({
    _id: integrationId,
    tenantId: tenant._id,
    provider: 'webhook_in',
    status: 'connected',
  })
    .select('+credentialsEncrypted')
    .setOptions({ bypassTenant: true });
  if (!doc) return null;
  return { tenant, integration: doc };
}

async function processInboundWebhook({ tenantSlug, integrationId, rawBody, signature, payload }) {
  const ctx = await resolveInboundIntegration(tenantSlug, integrationId);
  if (!ctx) {
    const err = new Error('Webhook endpoint not found');
    err.status = 404;
    throw err;
  }
  const credentials = unpackCredentials(ctx.integration.credentialsEncrypted);
  const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(payload);
  if (!webhookInAdapter.verifySignature(credentials.webhookSecret, bodyStr, signature)) {
    const err = new Error('Invalid webhook signature');
    err.status = 401;
    throw err;
  }

  const data = payload || JSON.parse(bodyStr);
  const person = data.person || {};
  const lead = data.lead || {};
  const email = person.email || data.email;
  const phone = person.phone || data.phone;
  const name = person.name || data.name || 'Webhook Lead';

  if (!email && !phone) {
    const err = new Error('person.email or person.phone required');
    err.status = 400;
    throw err;
  }

  const systemUser = await User.findOne({ tenantId: ctx.tenant._id })
    .setOptions({ bypassTenant: true })
    .sort({ createdAt: 1 });
  if (!systemUser) {
    const err = new Error('Tenant has no users');
    err.status = 500;
    throw err;
  }

  const result = await createLead(systemUser, {
    name,
    email,
    phone,
    source: lead.source || data.event || 'Inbound Webhook',
    leadStatus: lead.status || lead.leadStatus || 'New',
    crmType: 'standard',
  });

  if (result.error) {
    logger.warn('inboundWebhook', 'lead create', { error: result.error, status: result.status });
    const err = new Error(result.error);
    err.status = result.status || 400;
    throw err;
  }

  return { ok: true, leadId: result.lead?._id, event: data.event || 'lead.ingest' };
}

module.exports = {
  resolveInboundIntegration,
  processInboundWebhook,
};
