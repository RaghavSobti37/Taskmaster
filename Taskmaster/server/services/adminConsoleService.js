const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const TenantInvite = require('../models/TenantInvite');
const { listAuditEvents } = require('./auditEventService');
const { listSecurityAudits } = require('./securityAuditService');
const { getQueueAdminSnapshot } = require('./queueAdminService');
const { isAdminUser } = require('../utils/departmentPermissions');

function summarizeQueueHealth(snapshot) {
  if (!snapshot?.redisAvailable) {
    return { status: 'unavailable', label: 'Queues offline', failedJobs: 0 };
  }
  const queues = snapshot.queues || [];
  const failedJobs = queues.reduce((sum, q) => sum + (q.failed || 0), 0);
  const hasErrors = queues.some((q) => q.error);
  if (hasErrors || failedJobs > 0) {
    return { status: 'degraded', label: failedJobs > 0 ? `${failedJobs} failed jobs` : 'Queue errors', failedJobs };
  }
  return { status: 'healthy', label: 'All queues healthy', failedJobs: 0 };
}

async function getAdminConsoleSummary(req) {
  const tenantId = req.tenantId;
  if (!tenantId) {
    return { error: 'Active organization required' };
  }

  const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true }).lean();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    activeMembers,
    pendingInvites,
    recentActivity,
    securityAuditPage,
    queueSnapshot,
  ] = await Promise.all([
    TenantMembership.countDocuments({ tenantId, status: 'active' }).setOptions({ bypassTenant: true }),
    TenantInvite.countDocuments({ tenantId, status: 'pending' }).setOptions({ bypassTenant: true }),
    listAuditEvents(tenantId, { limit: 10 }),
    listSecurityAudits({ from: since.toISOString(), limit: 50 }),
    isAdminUser(req.user) ? getQueueAdminSnapshot() : Promise.resolve(null),
  ]);

  const recentSecurityFindings = (securityAuditPage?.logs || []).length;
  const queueHealth = queueSnapshot
    ? summarizeQueueHealth(queueSnapshot)
    : { status: 'hidden', label: 'Platform admin only', failedJobs: 0 };

  return {
    activeMembers,
    pendingInvites,
    recentSecurityFindings,
    queueHealth,
    setupStatus: {
      ssoConfigured: Boolean(tenant?.sso?.provider),
      domainVerified: Boolean(tenant?.allowedEmailDomain),
    },
    recentActivity: (recentActivity || []).map((row) => ({
      id: String(row._id),
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      actorEmail: row.actorEmail,
      timestamp: row.timestamp,
    })),
  };
}

module.exports = {
  getAdminConsoleSummary,
  summarizeQueueHealth,
};
