const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const { recordAuditEvent } = require('./auditEventService');

async function processDueOffboardings() {
  const due = await Tenant.find({
    'offboarding.scheduledDeletionAt': { $lte: new Date() },
    status: 'suspended',
  }).setOptions({ bypassTenant: true });

  for (const tenant of due) {
    await TenantMembership.updateMany(
      { tenantId: tenant._id },
      { status: 'suspended' },
    ).setOptions({ bypassTenant: true });
    tenant.status = 'suspended';
    tenant.offboarding.hardDeletedAt = new Date();
    await tenant.save();
    await recordAuditEvent({
      tenantId: tenant._id,
      action: 'tenant.offboard.executed',
      resourceType: 'tenant',
      resourceId: tenant._id,
      after: { status: tenant.status },
    });
  }
  return due.length;
}

module.exports = { processDueOffboardings };
