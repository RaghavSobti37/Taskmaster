const Tenant = require('../models/Tenant');
const { recordAuditEvent } = require('./auditEventService');
const { executeTenantCascadeDelete } = require('./tenantCascadeDeleteService');

async function processDueOffboardings() {
  const due = await Tenant.find({
    'offboarding.scheduledDeletionAt': { $lte: new Date() },
    status: 'suspended',
    'offboarding.hardDeletedAt': { $exists: false },
  }).setOptions({ bypassTenant: true });

  let deleted = 0;
  for (const tenant of due) {
    const tenantId = tenant._id;
    await recordAuditEvent({
      tenantId,
      action: 'tenant.offboard.executed',
      resourceType: 'tenant',
      resourceId: tenantId,
      after: { hardDeleted: true },
    });
    await executeTenantCascadeDelete(tenantId, { deleteClerk: true });
    deleted += 1;
  }
  return deleted;
}

module.exports = { processDueOffboardings };
