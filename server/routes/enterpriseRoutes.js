const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const { isAdminUser } = require('../utils/departmentPermissions');
const { getMembership } = require('../services/tenantMembershipService');
const { listAuditEvents, recordAuditEvent } = require('../services/auditEventService');
const { getPlanSnapshot } = require('../services/planEnforcementService');
const CustomRole = require('../models/CustomRole');
const Tenant = require('../models/Tenant');
const TenantApiKey = require('../models/TenantApiKey');
const TenantWebhook = require('../models/TenantWebhook');
const { createTenantApiKey } = require('../services/tenantApiKeyService');
const { createTenantWebhook, listDeliveryLogs } = require('../services/webhookDispatchService');
const { planAllowsFeature } = require('../../shared/planLimits.cjs');
const { queueTenantExport, getExportJob } = require('../services/tenantExportService');
const { issueScimBearer } = require('../services/tenantSecurityService');

const router = express.Router();

/** Org owner/admin or platform admin — not the nonexistent page key "admin". */
const requireTenantAdmin = asyncHandler(async (req, res, next) => {
  if (isAdminUser(req.user)) return next();
  if (!req.tenantId) {
    return res.status(403).json({ error: 'Active organization required' });
  }
  const membership = await getMembership(req.user._id, req.tenantId);
  if (membership && ['owner', 'admin'].includes(membership.role)) return next();
  return res.status(403).json({ error: 'Organization admin required' });
});

router.use(protect, requireTenantAdmin);

const assertActiveTenant = (req, res) => {
  if (!req.tenantId) {
    res.status(403).json({ error: 'Active organization required' });
    return false;
  }
  return true;
};

router.get(
  '/audit',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const { limit, cursor, action } = req.query;
    const rows = await listAuditEvents(req.tenantId, {
      limit: limit ? Number(limit) : 100,
      cursor,
      action,
    });
    res.json({ events: rows });
  }),
);

router.get(
  '/audit/export',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const tenant = await Tenant.findById(req.tenantId).select('plan');
    if (!planAllowsFeature(tenant?.plan || 'free', 'auditExport')) {
      return res.status(402).json({ error: 'Audit export requires enterprise plan', code: 'PLAN_UPGRADE_REQUIRED' });
    }
    const rows = await listAuditEvents(req.tenantId, { limit: 500 });
    const header = 'timestamp,action,resourceType,resourceId,actorEmail,ip\n';
    const lines = rows.map((r) => [
      r.timestamp?.toISOString?.() || '',
      r.action,
      r.resourceType || '',
      r.resourceId || '',
      r.actorEmail || '',
      r.ip || '',
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="audit-log.csv"');
    res.send(header + lines.join('\n'));
  }),
);

router.get(
  '/usage',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const snap = await getPlanSnapshot(req.tenantId);
    res.json(snap);
  }),
);

router.get(
  '/security',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const tenant = await Tenant.findById(req.tenantId)      .select('security sso domainVerification auditRetentionDays branding plan');
    if (!tenant) return res.status(404).json({ error: 'Organization not found' });
    res.json({
      security: tenant.security,
      sso: {
        provider: tenant.sso?.provider,
        metadataUrl: tenant.sso?.metadataUrl,
        clientId: tenant.sso?.clientId,
        enforceSSO: tenant.sso?.enforceSSO,
        jitDefaultRole: tenant.sso?.jitDefaultRole,
        scimBearerPrefix: tenant.sso?.scimBearerPrefix,
      },
      domainVerification: tenant.domainVerification,
      auditRetentionDays: tenant.auditRetentionDays,
      branding: tenant.branding,
      plan: tenant.plan,
    });
  }),
);

router.patch(
  '/security',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Organization not found' });
    const { security, sso, domainVerification, auditRetentionDays, branding } = req.body || {};
    if (security) tenant.security = { ...tenant.security?.toObject?.() || tenant.security || {}, ...security };
    if (sso) {
      if (!planAllowsFeature(tenant.plan, 'sso')) {
        return res.status(402).json({ error: 'SSO requires enterprise plan' });
      }
      tenant.sso = { ...tenant.sso?.toObject?.() || tenant.sso || {}, ...sso };
    }
    if (domainVerification) tenant.domainVerification = { ...tenant.domainVerification || {}, ...domainVerification };
    if (auditRetentionDays != null) tenant.auditRetentionDays = auditRetentionDays;
    if (branding) tenant.branding = { ...tenant.branding || {}, ...branding };
    tenant.updatedAt = new Date();
    await tenant.save();
    await recordAuditEvent({
      tenantId: req.tenantId,
      actorId: req.user._id,
      actorEmail: req.user.email,
      action: 'tenant.security.updated',
      resourceType: 'tenant',
      resourceId: tenant._id,
      after: { security: tenant.security, sso: tenant.sso },
      req,
    });
    res.json({ success: true });
  }),
);

router.get(
  '/roles',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const tenant = await Tenant.findById(req.tenantId).select('plan');
    if (!planAllowsFeature(tenant?.plan || 'free', 'customRoles')) {
      return res.status(402).json({ error: 'Custom roles require enterprise plan' });
    }
    const roles = await CustomRole.find({ tenantId: req.tenantId }).lean();
    res.json({ roles });
  }),
);

router.post(
  '/roles',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const tenant = await Tenant.findById(req.tenantId).select('plan');
    if (!planAllowsFeature(tenant?.plan || 'free', 'customRoles')) {
      return res.status(402).json({ error: 'Custom roles require enterprise plan' });
    }
    const { name, pageKeys, resourceScopes } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const role = await CustomRole.create({
      tenantId: req.tenantId,
      name: String(name).trim(),
      pageKeys: pageKeys || [],
      resourceScopes: resourceScopes || [],
      createdBy: req.user._id,
    });
    await recordAuditEvent({
      tenantId: req.tenantId,
      actorId: req.user._id,
      actorEmail: req.user.email,
      action: 'role.created',
      resourceType: 'customRole',
      resourceId: role._id,
      after: role.toObject(),
      req,
    });
    res.status(201).json({ role });
  }),
);

router.get(
  '/api-keys',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const tenant = await Tenant.findById(req.tenantId).select('plan');
    if (!planAllowsFeature(tenant?.plan || 'free', 'apiKeys')) {
      return res.status(402).json({ error: 'API keys require enterprise plan' });
    }
    const keys = await TenantApiKey.find({ tenantId: req.tenantId, revokedAt: null })
      .select('name keyPrefix scopes lastUsedAt createdAt')
      .lean();
    res.json({ keys });
  }),
);

router.post(
  '/api-keys',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const tenant = await Tenant.findById(req.tenantId).select('plan');
    if (!planAllowsFeature(tenant?.plan || 'free', 'apiKeys')) {
      return res.status(402).json({ error: 'API keys require enterprise plan' });
    }
    const { name, scopes } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const { key, prefix } = await createTenantApiKey({
      tenantId: req.tenantId,
      name: String(name).trim(),
      scopes,
      createdBy: req.user._id,
    });
    await recordAuditEvent({
      tenantId: req.tenantId,
      actorId: req.user._id,
      actorEmail: req.user.email,
      action: 'apiKey.created',
      resourceType: 'apiKey',
      resourceId: prefix,
      req,
    });
    res.status(201).json({ key, prefix, warning: 'Store this key now; it will not be shown again.' });
  }),
);

router.delete(
  '/api-keys/:id',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const key = await TenantApiKey.findOne({ _id: req.params.id, tenantId: req.tenantId, revokedAt: null });
    if (!key) return res.status(404).json({ error: 'API key not found' });
    key.revokedAt = new Date();
    await key.save();
    await recordAuditEvent({
      tenantId: req.tenantId,
      actorId: req.user._id,
      actorEmail: req.user.email,
      action: 'apiKey.revoked',
      resourceType: 'apiKey',
      resourceId: key._id,
      req,
    });
    res.json({ success: true });
  }),
);

router.get(
  '/webhooks',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const tenant = await Tenant.findById(req.tenantId).select('plan');
    if (!planAllowsFeature(tenant?.plan || 'free', 'webhooks')) {
      return res.status(402).json({ error: 'Webhooks require enterprise plan' });
    }
    const hooks = await TenantWebhook.find({ tenantId: req.tenantId })
      .select('url events active lastDeliveryAt lastStatus failureCount secretPrefix createdAt')
      .lean();
    res.json({ webhooks: hooks });
  }),
);

router.post(
  '/webhooks',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const tenant = await Tenant.findById(req.tenantId).select('plan');
    if (!planAllowsFeature(tenant?.plan || 'free', 'webhooks')) {
      return res.status(402).json({ error: 'Webhooks require enterprise plan' });
    }
    const { url, events } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url required' });
    const { webhook, secret } = await createTenantWebhook({
      tenantId: req.tenantId,
      url,
      events,
      createdBy: req.user._id,
    });
    res.status(201).json({ webhook, secret, warning: 'Store signing secret now; it will not be shown again.' });
  }),
);

router.get(
  '/webhooks/deliveries',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const tenant = await Tenant.findById(req.tenantId).select('plan');
    if (!planAllowsFeature(tenant?.plan || 'free', 'webhooks')) {
      return res.status(402).json({ error: 'Webhooks require enterprise plan' });
    }
    const logs = await listDeliveryLogs(req.tenantId, {
      limit: req.query.limit ? Number(req.query.limit) : 50,
      webhookId: req.query.webhookId,
    });
    res.json({ deliveries: logs });
  }),
);

router.delete(
  '/webhooks/:id',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const hook = await TenantWebhook.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!hook) return res.status(404).json({ error: 'Webhook not found' });
    hook.active = false;
    await hook.save();
    await recordAuditEvent({
      tenantId: req.tenantId,
      actorId: req.user._id,
      actorEmail: req.user.email,
      action: 'webhook.deactivated',
      resourceType: 'webhook',
      resourceId: hook._id,
      req,
    });
    res.json({ success: true });
  }),
);

router.post(
  '/scim/token',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const tenant = await Tenant.findById(req.tenantId).select('plan sso');
    if (!planAllowsFeature(tenant?.plan || 'free', 'sso')) {
      return res.status(402).json({ error: 'SCIM requires enterprise plan' });
    }
    const { token, prefix, hash } = issueScimBearer();
    tenant.sso = tenant.sso || {};
    tenant.sso.scimBearerHash = hash;
    tenant.sso.scimBearerPrefix = prefix;
    await tenant.save();
    await recordAuditEvent({
      tenantId: req.tenantId,
      actorId: req.user._id,
      actorEmail: req.user.email,
      action: 'scim.token.issued',
      resourceType: 'tenant',
      resourceId: tenant._id,
      req,
    });
    res.status(201).json({ token, prefix, warning: 'Store SCIM bearer now; it will not be shown again.' });
  }),
);

router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json({
      status: 'operational',
      components: { api: 'operational', database: 'operational', webhooks: 'operational' },
      updatedAt: new Date().toISOString(),
    });
  }),
);

router.post(
  '/export',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const { jobId, status } = await queueTenantExport({
      tenantId: req.tenantId,
      actorId: req.user._id,
      actorEmail: req.user.email,
      req,
    });
    await recordAuditEvent({
      tenantId: req.tenantId,
      actorId: req.user._id,
      actorEmail: req.user.email,
      action: 'tenant.data.export.requested',
      resourceType: 'tenant',
      resourceId: jobId,
      req,
    });
    res.status(202).json({ status, jobId });
  }),
);

router.get(
  '/export/:jobId',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const job = getExportJob(req.params.jobId, req.tenantId);
    if (!job) return res.status(404).json({ error: 'Export job not found' });
    if (job.status !== 'complete' || !job.filePath) {
      return res.json({ status: job.status, error: job.error });
    }
    res.download(job.filePath, `tenant-export-${req.tenantId}.json`);
  }),
);

router.post(
  '/offboard',
  asyncHandler(async (req, res) => {
    if (!assertActiveTenant(req, res)) return;
    const membership = await require('../models/TenantMembership').findOne({
      tenantId: req.tenantId,
      userId: req.user._id,
      status: 'active',
    });
    if (!membership || membership.role !== 'owner') {
      if (!isAdminUser(req.user)) {
        return res.status(403).json({ error: 'Organization owner required' });
      }
    }
    const tenant = await Tenant.findById(req.tenantId);
    const graceDays = process.env.NODE_ENV === 'development' ? 0 : 14;
    tenant.offboarding = {
      scheduledDeletionAt: new Date(Date.now() + graceDays * 86400000),
      requestedBy: req.user._id,
    };
    tenant.status = 'suspended';
    await tenant.save();
    await recordAuditEvent({
      tenantId: req.tenantId,
      actorId: req.user._id,
      actorEmail: req.user.email,
      action: 'tenant.offboard.scheduled',
      resourceType: 'tenant',
      resourceId: tenant._id,
      after: tenant.offboarding,
      req,
    });

    if (graceDays === 0) {
      const { processDueOffboardings } = require('../services/tenantOffboardingService');
      await processDueOffboardings();
      return res.json({ deleted: true, immediate: true });
    }

    res.json({ scheduledDeletionAt: tenant.offboarding.scheduledDeletionAt });
  }),
);

module.exports = router;
