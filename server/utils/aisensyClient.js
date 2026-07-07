const { recordOutboundSend } = require('../services/aisensyCampaignSyncService');
const { runWithContext, getTenantId } = require('./tenantContext');
const { resolveDefaultTenantId } = require('./defaultTenant');
const { resolveAisensyCredentials } = require('../domains/integrations-hub/services/aisensyIntegrationService');

const AISENSY_API_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';

async function syncSendToDataHub(payload, tenantId) {
  try {
    const resolvedTenantId = tenantId || getTenantId() || await resolveDefaultTenantId();
    if (!resolvedTenantId) return;
    await runWithContext({ tenantId: String(resolvedTenantId) }, () => recordOutboundSend(payload));
  } catch (err) {
    const logger = require('./logger');
    logger.warn('aisensy', 'datahub sync after send failed', { error: err.message });
  }
}

async function resolveCredentials(options = {}) {
  const tenantId = options.tenantId || getTenantId();
  if (tenantId) {
    const tenantCreds = await resolveAisensyCredentials(tenantId);
    if (tenantCreds?.apiKey) return tenantCreds;
  }
  if (process.env.AISENSY_API_KEY) {
    return {
      apiKey: process.env.AISENSY_API_KEY,
      defaultCampaign: process.env.AISENSY_DEFAULT_CAMPAIGN || '',
    };
  }
  return null;
}

async function sendAiSensyMessage(destination, campaign, params, attributes, userName, options = {}) {
  const logger = require('./logger');
  if (!destination || !campaign) return;

  const creds = await resolveCredentials(options);
  if (!creds?.apiKey) {
    console.warn('[Warning] AiSensy not connected — set API key in Connected Apps or AISENSY_API_KEY');
    return;
  }

  const cleanDestination = String(destination).replace(/\D/g, '');
  const tags = Array.isArray(options.tags) ? options.tags : [];
  const body = {
    apiKey: creds.apiKey,
    campaignName: campaign,
    destination: cleanDestination,
    templateParams: params,
    userName: userName || 'User',
  };
  if (attributes) body.attributes = attributes;
  if (tags.length) body.tags = tags;

  try {
    const res = await fetch(AISENSY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) {
      console.error(`[AiSensy] ${campaign} failed (${res.status}):`, json);
      await syncSendToDataHub({
        campaignName: campaign,
        destination: cleanDestination,
        userName,
        tags,
        messageId: json?.messageId || json?.id,
        attributes: { ...(attributes || {}), sendError: json },
      }, options.tenantId);
      return { ok: false, status: res.status, body: json };
    }
    logger.debug('aisensy', `${campaign} sent`, {
      destination: cleanDestination.slice(-4).padStart(cleanDestination.length, '*'),
    });

    const messageId = json?.messageId || json?.id || json?.data?.messageId;
    await syncSendToDataHub({
      campaignName: campaign,
      destination: cleanDestination,
      userName,
      tags,
      messageId,
      attributes,
    }, options.tenantId);

    return { ok: true, status: res.status, body: json, messageId };
  } catch (e) {
    console.error('[AiSensy] Fetch Error:', e.message || e);
    return { ok: false, error: e.message || String(e) };
  }
}

module.exports = { sendAiSensyMessage, resolveCredentials };
