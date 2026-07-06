const asyncHandler = require('../../../middleware/asyncHandler');
const { protect } = require('../../../middleware/authMiddleware');
const { isAdminUser } = require('../../../utils/departmentPermissions');
const { getMembership } = require('../../../services/tenantMembershipService');
const { resolveClientUrl } = require('../../../utils/oauthEnv');
const { TENANT_WEBHOOK_EVENTS } = require('../../../config/integrationProviders.config');
const integrationService = require('../services/integrationService');
const integrationSyncService = require('../services/integrationSyncService');
const inboundWebhookService = require('../services/inboundWebhookService');
const { getOAuthReadiness } = require('../../integrations/controllers/integrationsVerifyController');

const requireTenantAdmin = asyncHandler(async (req, res, next) => {
  if (isAdminUser(req.user)) return next();
  if (!req.tenantId) return res.status(403).json({ error: 'Active organization required' });
  const membership = await getMembership(req.user._id, req.tenantId);
  if (membership && ['owner', 'admin'].includes(membership.role)) return next();
  return res.status(403).json({ error: 'Organization admin required' });
});

exports.listProviders = asyncHandler(async (req, res) => {
  if (!req.tenantId) return res.status(403).json({ error: 'Active organization required' });
  const providers = await integrationService.listProvidersWithStatus(req.tenantId);
  res.json({ providers, webhookEvents: TENANT_WEBHOOK_EVENTS });
});

exports.listConnections = asyncHandler(async (req, res) => {
  if (!req.tenantId) return res.status(403).json({ error: 'Active organization required' });
  const connections = await integrationService.listConnections(req.tenantId);
  res.json({ connections });
});

exports.connect = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { apiKey, label, mode } = req.body || {};

  if (provider === 'webhook_in' || mode === 'webhook') {
    const result = await integrationService.provisionWebhookIn({
      tenantId: req.tenantId,
      userId: req.user._id,
      req,
      label,
    });
    return res.status(201).json(result);
  }

  if (apiKey) {
    const connection = await integrationService.connectWithApiKey({
      tenantId: req.tenantId,
      provider,
      apiKey,
      userId: req.user._id,
      req,
      label,
    });
    return res.status(201).json({ connection });
  }

  const { authUrl, state } = await integrationService.initiateOAuth({
    tenantId: req.tenantId,
    provider,
    userId: req.user._id,
    req,
    returnUrl: req.body?.returnUrl,
  });
  res.json({ authUrl, state });
});

exports.oauthCallback = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { code, state, error } = req.query;
  const front = resolveClientUrl();
  const returnBase = `${front}/settings?tab=integrations`;

  if (error) {
    return res.redirect(`${returnBase}&connect_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return res.redirect(`${returnBase}&connect_error=missing_code`);
  }

  try {
    const { returnUrl } = await integrationService.handleOAuthCallback({
      provider,
      code,
      state,
      req,
    });
    const dest = returnUrl || returnBase;
    return res.redirect(`${dest}&connected=${provider}`);
  } catch (err) {
    return res.redirect(`${returnBase}&connect_error=${encodeURIComponent(err.message)}`);
  }
});

exports.disconnect = asyncHandler(async (req, res) => {
  const result = await integrationService.disconnectConnection({
    integrationId: req.params.id,
    tenantId: req.tenantId,
    userId: req.user._id,
    req,
  });
  res.json(result);
});

exports.health = asyncHandler(async (req, res) => {
  const result = await integrationService.runHealthCheck({
    integrationId: req.params.id,
    tenantId: req.tenantId,
  });
  res.json(result);
});

exports.sync = asyncHandler(async (req, res) => {
  const result = await integrationSyncService.runSync({
    integrationId: req.params.id,
    tenantId: req.tenantId,
  });
  res.json(result);
});

exports.patchMetadata = asyncHandler(async (req, res) => {
  const TenantIntegration = require('../models/TenantIntegration');
  const doc = await TenantIntegration.findOne({ _id: req.params.id, tenantId: req.tenantId })
    .setOptions({ bypassTenant: true });
  if (!doc) return res.status(404).json({ error: 'Integration not found' });
  doc.metadata = { ...doc.metadata, ...(req.body?.metadata || {}) };
  await doc.save();
  res.json({ connection: integrationService.serializeConnection(doc) });
});

exports.inboundWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-coreknot-signature'] || req.headers['x-hub-signature-256'];
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const result = await inboundWebhookService.processInboundWebhook({
    tenantSlug: req.params.tenantSlug,
    integrationId: req.params.integrationId,
    rawBody,
    signature,
    payload: req.body,
  });
  res.json(result);
});

exports.listKeBridge = asyncHandler(async (req, res) => {
  const { listKnowledgeEngineConnections } = require('../services/knowledgeEngineBridge');
  const rows = await listKnowledgeEngineConnections(req.tenantId);
  res.json({ connections: rows });
});

exports.oauthReadiness = getOAuthReadiness;

exports.requireTenantAdmin = requireTenantAdmin;
