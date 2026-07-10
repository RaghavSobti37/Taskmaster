/**
 * Backfill tenantId on models that gained tenantPlugin.
 * Usage: node server/scripts/backfillMissingTenantIds.js
 *        node server/scripts/backfillMissingTenantIds.js --prod
 *        node server/scripts/backfillMissingTenantIds.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Artist = require('../models/Artist');
const Tenant = require('../models/Tenant');
const LeaveRequest = require('../models/LeaveRequest');
const DashboardPreset = require('../models/DashboardPreset');
const DailyMission = require('../models/DailyMission');
const XPAuditLog = require('../models/XPAuditLog');
const CRMStatSnapshot = require('../domains/crm/models/CRMStatSnapshot');
const ArtistAuth = require('../models/ArtistAuth');
const ArtistMetrics = require('../models/ArtistMetrics');
const ArtistConnection = require('../models/ArtistConnection');

const useProd = process.argv.includes('--prod');
const dryRun = process.argv.includes('--dry-run');
const BYPASS = { bypassTenant: true };

const missingTenantFilter = { $or: [{ tenantId: { $exists: false } }, { tenantId: null }] };

async function resolveDefaultTenantId() {
  const envId = (process.env.WEBHOOK_TENANT_ID || process.env.DEFAULT_TENANT_ID || '').trim();
  if (envId && mongoose.Types.ObjectId.isValid(envId)) {
    return new mongoose.Types.ObjectId(envId);
  }
  const tenant = await Tenant.findOne().sort({ createdAt: 1 }).setOptions(BYPASS).lean();
  if (!tenant) throw new Error('No tenant found for backfill fallback');
  return tenant._id;
}

async function backfillFromUser(Model, label) {
  const docs = await Model.find(missingTenantFilter).setOptions(BYPASS).select('_id userId').lean();
  let updated = 0;
  for (const doc of docs) {
    if (!doc.userId) continue;
    const user = await User.findById(doc.userId).setOptions(BYPASS).select('tenantId').lean();
    const tenantId = user?.tenantId;
    if (!tenantId) continue;
    if (!dryRun) {
      await Model.updateOne({ _id: doc._id }, { $set: { tenantId } }).setOptions(BYPASS);
    }
    updated += 1;
  }
  console.log(`${label}: ${updated} docs`);
  return updated;
}

async function backfillFromArtist(Model, label) {
  const docs = await Model.find(missingTenantFilter).setOptions(BYPASS).select('_id artistId').lean();
  let updated = 0;
  for (const doc of docs) {
    if (!doc.artistId) continue;
    const artist = await Artist.findById(doc.artistId).setOptions(BYPASS).select('tenantId').lean();
    const tenantId = artist?.tenantId;
    if (!tenantId) continue;
    if (!dryRun) {
      await Model.updateOne({ _id: doc._id }, { $set: { tenantId } }).setOptions(BYPASS);
    }
    updated += 1;
  }
  console.log(`${label}: ${updated} docs`);
  return updated;
}

async function backfillCrmStatSnapshots(fallbackTenantId) {
  const docs = await CRMStatSnapshot.find(missingTenantFilter).setOptions(BYPASS).select('_id repId').lean();
  let updated = 0;
  for (const doc of docs) {
    let tenantId = fallbackTenantId;
    if (doc.repId) {
      const user = await User.findById(doc.repId).setOptions(BYPASS).select('tenantId').lean();
      if (user?.tenantId) tenantId = user.tenantId;
    }
    if (!dryRun) {
      await CRMStatSnapshot.updateOne({ _id: doc._id }, { $set: { tenantId } }).setOptions(BYPASS);
    }
    updated += 1;
  }
  console.log(`CRMStatSnapshot: ${updated} docs`);
  return updated;
}

async function backfillGamificationConfigs() {
  const GamificationConfig = require('../models/GamificationConfig');
  const globalConfigs = await GamificationConfig.find(missingTenantFilter).setOptions(BYPASS).lean();
  const tenants = await Tenant.find().setOptions(BYPASS).select('_id').lean();
  const template = globalConfigs[0] || null;
  let seeded = 0;

  for (const tenant of tenants) {
    const existing = await GamificationConfig.findOne({ tenantId: tenant._id }).setOptions(BYPASS);
    if (existing) continue;
    const { _id, __v, createdAt, updatedAt, ...rest } = template || {};
    if (!dryRun) {
      await GamificationConfig.create({ ...rest, tenantId: tenant._id });
    }
    seeded += 1;
  }

  if (globalConfigs.length > 0 && !dryRun) {
    await GamificationConfig.deleteMany(missingTenantFilter).setOptions(BYPASS);
  }
  console.log(`GamificationConfig: seeded ${seeded}, removed ${globalConfigs.length} global row(s)`);
}

async function migrateDashboardPresetIndexes() {
  const coll = mongoose.connection.db.collection('dashboardPresets');
  const indexes = await coll.indexes();
  const legacy = indexes.find((idx) => idx.name === 'userId_1' && idx.unique);
  if (legacy) {
    if (!dryRun) {
      await coll.dropIndex('userId_1');
    }
    console.log(`DashboardPreset: ${dryRun ? 'would drop' : 'dropped'} legacy userId_1 unique index`);
  }
}

async function main() {
  const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
  if (!uri) throw new Error(useProd ? 'MONGODB_URI_PROD missing' : 'MONGODB_URI missing');

  await mongoose.connect(uri);
  const fallbackTenantId = await resolveDefaultTenantId();
  console.log(`${dryRun ? '[dry-run] ' : ''}${useProd ? 'prod' : 'local'} (${mongoose.connection.db.databaseName}) fallback tenant ${fallbackTenantId}`);

  await backfillFromUser(LeaveRequest, 'LeaveRequest');
  await backfillFromUser(DashboardPreset, 'DashboardPreset');
  await backfillFromUser(DailyMission, 'DailyMission');
  await backfillFromUser(XPAuditLog, 'XPAuditLog');
  await backfillCrmStatSnapshots(fallbackTenantId);
  await backfillFromArtist(ArtistAuth, 'ArtistAuth');
  await backfillFromArtist(ArtistMetrics, 'ArtistMetrics');
  await backfillFromArtist(ArtistConnection, 'ArtistConnection');
  await backfillGamificationConfigs();
  await migrateDashboardPresetIndexes();

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
