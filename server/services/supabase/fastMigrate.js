const mongoose = require('mongoose');
const Log = require('../../models/Log');
const SystemLog = require('../../models/SystemLog');
const CRMAudit = require('../../models/CRMAudit');
const XPAuditLog = require('../../models/XPAuditLog');
const QATestRun = require('../../models/QATestRun');
const CRMStatSnapshot = require('../../models/CRMStatSnapshot');
const { isSupabaseEnabled } = require('../../config/supabase');
const { insertMappedBatch } = require('./batchInsert');
const { mirrorCrmStatSnapshotsFromMongo } = require('./snapshotStore');
const { syncMailRollupsForAllUsers } = require('./mailRollupStore');
const logger = require('../../utils/logger');

const BATCH_SIZE = 500;
const USER_ROLLUP_CONCURRENCY = 6;

const COLLECTIONS = [
  { stream: 'app_logs', model: Log, table: 'app_logs' },
  { stream: 'system_logs', model: SystemLog, table: 'system_logs' },
  { stream: 'crm_audits', model: CRMAudit, table: 'crm_audits' },
  { stream: 'xp_audit_logs', model: XPAuditLog, table: 'xp_audit_logs' },
  { stream: 'qa_test_runs', model: QATestRun, table: 'qa_test_runs' },
];

async function backfillCollectionFast(model, table) {
  const started = Date.now();
  let processed = 0;
  let lastId = null;

  while (true) {
    const filter = lastId && mongoose.Types.ObjectId.isValid(lastId)
      ? { _id: { $gt: new mongoose.Types.ObjectId(lastId) } }
      : {};

    const docs = await model.find(filter).sort({ _id: 1 }).limit(BATCH_SIZE).lean();
    if (!docs.length) break;

    await insertMappedBatch(table, docs);
    lastId = docs[docs.length - 1]._id.toString();
    processed += docs.length;
  }

  return {
    table,
    processed,
    durationMs: Date.now() - started,
  };
}

async function runFastDataMigration() {
  if (!isSupabaseEnabled()) {
    return { skipped: true, reason: 'disabled' };
  }

  const started = Date.now();
  const results = await Promise.all(
    COLLECTIONS.map(({ model, table }) => backfillCollectionFast(model, table))
  );

  const snapshots = await CRMStatSnapshot.find({}).lean();
  await mirrorCrmStatSnapshotsFromMongo(snapshots);

  return {
    collections: results,
    crmSnapshots: snapshots.length,
    durationMs: Date.now() - started,
  };
}

async function runFastRollupMigration() {
  const started = Date.now();
  const rollup = await syncMailRollupsForAllUsers();
  return { rollup, durationMs: Date.now() - started };
}

async function runFastMigration() {
  const data = await runFastDataMigration();
  const rollups = await runFastRollupMigration();
  logger.info('SupabaseFastMigrate', 'Migration complete', { data, rollups });
  return { data, rollups };
}

module.exports = {
  runFastMigration,
  runFastDataMigration,
  runFastRollupMigration,
  backfillCollectionFast,
  BATCH_SIZE,
  USER_ROLLUP_CONCURRENCY,
};
