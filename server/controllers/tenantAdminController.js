const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');

exports.listTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find()
      .setOptions({ bypassTenant: true })
      .select('name slug clerkOrganizationId allowedEmailDomain status contactEmail createdAt updatedAt')
      .sort({ name: 1 })
      .lean();
    res.json({ tenants });
  } catch (error) {
    logger.error('tenantAdmin', 'listTenants', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};

exports.updateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id).setOptions({ bypassTenant: true });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const {
      clerkOrganizationId,
      allowedEmailDomain,
      status,
      name,
      contactEmail,
    } = req.body || {};

    if (clerkOrganizationId !== undefined) {
      const normalized = String(clerkOrganizationId || '').trim() || null;
      if (normalized) {
        const clash = await Tenant.findOne({
          clerkOrganizationId: normalized,
          _id: { $ne: tenant._id },
        }).setOptions({ bypassTenant: true });
        if (clash) {
          return res.status(409).json({ error: 'Clerk organization already linked to another tenant' });
        }
      }
      tenant.clerkOrganizationId = normalized;
    }
    if (allowedEmailDomain !== undefined) {
      tenant.allowedEmailDomain = String(allowedEmailDomain || '').trim().toLowerCase() || undefined;
    }
    if (status !== undefined && ['active', 'suspended', 'trial'].includes(status)) {
      tenant.status = status;
    }
    if (name !== undefined) tenant.name = String(name).trim();
    if (contactEmail !== undefined) tenant.contactEmail = String(contactEmail).trim().toLowerCase();
    tenant.updatedAt = new Date();

    await tenant.save();
    res.json({ tenant });
  } catch (error) {
    logger.error('tenantAdmin', 'updateTenant', { error: error.message });
    res.status(error.code === 11000 ? 409 : 500).json({ error: error.message });
  }
};

exports.exportTenant = async (req, res) => {
  try {
    const { exportTenantData } = require('../services/tenantExportService');
    const payload = await exportTenantData(req.params.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="tenant-${req.params.id}-export.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    logger.error('tenantAdmin', 'exportTenant', { error: error.message });
    res.status(error.status || 500).json({ error: error.message });
  }
};

exports.deleteTenant = async (req, res) => {
  try {
    const { scheduleTenantDeletion } = require('../services/tenantExportService');
    const result = await scheduleTenantDeletion(req.params.id, req.user._id.toString());
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('tenantAdmin', 'deleteTenant', { error: error.message });
    res.status(error.status || 500).json({ error: error.message });
  }
};
