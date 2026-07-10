const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Lead = require('../domains/crm/models/Lead');
const TenantMembership = require('../models/TenantMembership');
const { recordAuditEvent } = require('./auditEventService');

const EXPORT_DIR = path.join(os.tmpdir(), 'coreknot-tenant-exports');
const jobs = new Map();

async function collectTenantPayload(tenantId) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const [projects, leads, memberships] = await Promise.all([
    Project.find({ tenantId: tid }).setOptions({ bypassTenant: true }).lean(),
    Lead.find({ tenantId: tid }).setOptions({ bypassTenant: true }).lean(),
    TenantMembership.find({ tenantId: tid }).setOptions({ bypassTenant: true }).lean(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    tenantId: String(tenantId),
    counts: { projects: projects.length, leads: leads.length, memberships: memberships.length },
    projects,
    leads,
    memberships,
  };
}

async function queueTenantExport({ tenantId, actorId, actorEmail, req }) {
  const jobId = `${tenantId}-${Date.now()}`;
  jobs.set(jobId, { status: 'running', tenantId: String(tenantId), startedAt: new Date() });

  setImmediate(async () => {
    try {
      if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });
      const payload = await collectTenantPayload(tenantId);
      const filePath = path.join(EXPORT_DIR, `${jobId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
      jobs.set(jobId, {
        status: 'complete',
        tenantId: String(tenantId),
        filePath,
        completedAt: new Date(),
        counts: payload.counts,
      });
      await recordAuditEvent({
        tenantId,
        actorId,
        actorEmail,
        action: 'tenant.data.export.completed',
        resourceType: 'tenantExport',
        resourceId: jobId,
        after: payload.counts,
        req,
      });
    } catch (err) {
      jobs.set(jobId, { status: 'failed', tenantId: String(tenantId), error: err.message });
    }
  });

  return { jobId, status: 'queued' };
}

function getExportJob(jobId, tenantId) {
  const job = jobs.get(jobId);
  if (!job || job.tenantId !== String(tenantId)) return null;
  return job;
}

module.exports = {
  queueTenantExport,
  getExportJob,
  EXPORT_DIR,
};
