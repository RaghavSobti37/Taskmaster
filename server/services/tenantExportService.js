const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');

const TENANT_SCOPED_MODELS = [
  'User',
  'Lead',
  'Task',
  'Project',
  'Log',
  'SecurityAudit',
];

async function exportTenantData(tenantId) {
  const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true }).lean();
  if (!tenant) {
    const err = new Error('Tenant not found');
    err.status = 404;
    throw err;
  }

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    tenant,
    collections: {},
  };

  for (const name of TENANT_SCOPED_MODELS) {
    try {
      const Model = mongoose.model(name);
      const docs = await Model.find({ tenantId })
        .setOptions({ bypassTenant: true })
        .lean();
      exportPayload.collections[name] = docs;
    } catch (error) {
      logger.warn('tenantExport', `Skip ${name}`, { error: error.message });
    }
  }

  return exportPayload;
}

async function scheduleTenantDeletion(tenantId, actorId) {
  const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true });
  if (!tenant) {
    const err = new Error('Tenant not found');
    err.status = 404;
    throw err;
  }

  tenant.status = 'suspended';
  tenant.updatedAt = new Date();
  await tenant.save();

  const users = await User.find({ tenantId }).setOptions({ bypassTenant: true });
  const { revokeAllUserSessions } = require('../utils/sessionRegistry');
  for (const user of users) {
    user.suspended = true;
    user.suspendedAt = user.suspendedAt || new Date();
    user.suspensionReason = `Tenant offboarding scheduled by admin ${actorId}`;
    // eslint-disable-next-line no-await-in-loop
    await user.save();
    // eslint-disable-next-line no-await-in-loop
    await revokeAllUserSessions(user._id.toString());
  }

  return {
    tenantId: tenant._id.toString(),
    usersSuspended: users.length,
    purgeNote: 'Hard purge after 30d — cron job follow-up',
  };
}

module.exports = {
  exportTenantData,
  scheduleTenantDeletion,
  TENANT_SCOPED_MODELS,
};
