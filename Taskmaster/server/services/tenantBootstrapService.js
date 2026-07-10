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

const isLegacyCrmConfigDuplicate = (err) => (
  err?.code === 11000 && /crmconfigs.*configKey_1|configKey:\s*"default"/i.test(String(err?.message || ''))
);

const isLegacyMainWorkspaceDuplicate = (err) => (
  err?.code === 11000 && /workspaces.*name_1|name:\s*"MAIN"/i.test(String(err?.message || ''))
);

async function ensureMainWorkspace(creatorUserId) {
  try {
    await Workspace.findOneAndUpdate(
      { name: 'MAIN' },
      {
        $setOnInsert: {
          name: 'MAIN',
          color: '#64748b',
          order: 0,
          createdBy: creatorUserId || undefined,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return;
  } catch (err) {
    if (!isLegacyMainWorkspaceDuplicate(err)) throw err;
  }

  // Legacy DBs may still have an old global unique index on name.
  try {
    await Workspace.collection.dropIndex('name_1');
  } catch (dropErr) {
    const msg = String(dropErr?.message || '');
    if (!/index not found|ns not found|index does not exist/i.test(msg)) {
      throw dropErr;
    }
  }

  await Workspace.findOneAndUpdate(
    { name: 'MAIN' },
    {
      $setOnInsert: {
        name: 'MAIN',
        color: '#64748b',
        order: 0,
        createdBy: creatorUserId || undefined,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

async function ensureDefaultCrmConfig() {
  try {
    await CRMConfig.findOneAndUpdate(
      { configKey: 'default' },
      { $setOnInsert: DEFAULT_CRM_CONFIG },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return;
  } catch (err) {
    if (!isLegacyCrmConfigDuplicate(err)) throw err;
  }

  // Legacy DBs may still have an old global unique index on configKey.
  // Drop stale index and retry tenant-scoped upsert.
  try {
    await CRMConfig.collection.dropIndex('configKey_1');
  } catch (dropErr) {
    const msg = String(dropErr?.message || '');
    if (!/index not found|ns not found|index does not exist/i.test(msg)) {
      throw dropErr;
    }
  }

  await CRMConfig.findOneAndUpdate(
    { configKey: 'default' },
    { $setOnInsert: DEFAULT_CRM_CONFIG },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

/**
 * Bootstrap a fresh tenant with isolated defaults (departments, workspace, CRM, gamification).
 * Must run after Tenant row exists; caller supplies creator userId for workspace attribution.
 */
async function bootstrapTenant(tenantId, { creatorUserId } = {}) {
  if (!tenantId) throw new Error('tenantId required for bootstrap');

  return runWithContext({ tenantId: String(tenantId), userId: creatorUserId ? String(creatorUserId) : undefined }, async () => {
    await seedDepartmentsForTenant(tenantId);

    const existingWorkspace = await Workspace.findOne({ name: 'MAIN' });
    await ensureMainWorkspace(creatorUserId);

    const existingCrm = await CRMConfig.findOne({ configKey: 'default' });
    await ensureDefaultCrmConfig();

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
