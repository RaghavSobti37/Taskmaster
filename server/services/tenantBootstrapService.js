const Workspace = require('../models/Workspace');
const CRMConfig = require('../domains/crm/models/CRMConfig');
const GamificationService = require('./gamificationService');
const { seedDepartmentsForTenant } = require('./departmentService');
const { runWithContext } = require('../utils/tenantContext');

const DEFAULT_CRM_CONFIG = {
  configKey: 'default',
  callStatuses: ['Pending', 'Connected', 'Busy', 'DNP', 'Switched Off'],
  leadStatuses: ['New', 'Interested', 'Not Interested', 'Followup', 'Converted'],
  artistTypes: ['Full Time', 'Part Time', 'Hobbyist'],
  meaningfulConnectStatuses: ['YES', 'NO', 'PENDING'],
  qualities: ['1', '2', '3', '4', '5'],
};

/**
 * Bootstrap a fresh tenant with isolated defaults (departments, workspace, CRM, gamification).
 * Must run after Tenant row exists; caller supplies creator userId for workspace attribution.
 */
async function bootstrapTenant(tenantId, { creatorUserId } = {}) {
  if (!tenantId) throw new Error('tenantId required for bootstrap');

  return runWithContext({ tenantId: String(tenantId), userId: creatorUserId ? String(creatorUserId) : undefined }, async () => {
    await seedDepartmentsForTenant(tenantId);

    const existingWorkspace = await Workspace.findOne({ name: 'MAIN' });
    if (!existingWorkspace) {
      await Workspace.create({
        name: 'MAIN',
        color: '#64748b',
        order: 0,
        createdBy: creatorUserId || undefined,
      });
    }

    const existingCrm = await CRMConfig.findOne({ configKey: 'default' });
    if (!existingCrm) {
      await CRMConfig.create(DEFAULT_CRM_CONFIG);
    }

    await GamificationService.ensureConfigForTenant();

    return {
      departmentsSeeded: true,
      workspaceCreated: !existingWorkspace,
      crmConfigCreated: !existingCrm,
      gamificationConfigCreated: true,
    };
  });
}

module.exports = {
  bootstrapTenant,
  DEFAULT_CRM_CONFIG,
};
