const mongoose = require('mongoose');
const Log = require('../../models/Log');
const CRMAudit = require('../../models/CRMAudit');
const XPAuditLog = require('../../models/XPAuditLog');
const QATestRun = require('../../models/QATestRun');
const CRMStatSnapshot = require('../../models/CRMStatSnapshot');
const { isSupabaseEnabled } = require('../../config/supabase');
const { queryPg, preferRestPostgres } = require('./client');
const { upsertRows, selectRows } = require('./restQuery');
const { insertMappedBatch } = require('./batchInsert');
const { syncMailRollupsForAllUsers } = require('./mailRollupStore');
const { mirrorCrmStatSnapshotsFromMongo } = require('./snapshotStore');
const logger = require('../../utils/logger');

const BATCH_SIZE = 200;

async function getSyncCursor(stream) {
  if (preferRestPostgres()) {
    const rows = await selectRows('supabase_sync_state', {
      columns: 'last_mongo_id,last_synced_at',
      filters: [['eq', ['stream', stream]]],
      limit: 1,
    });
    return rows[0] || null;
  }
  const { rows } = await queryPg(
    'select last_mongo_id, last_synced_at from supabase_sync_state where stream = $1',
    [stream]
  );
  return rows[0] || null;
}

async function setSyncCursor(stream, lastMongoId, meta = {}) {
  if (preferRestPostgres()) {
    await upsertRows('supabase_sync_state', [{
      stream,
      last_synced_at: new Date().toISOString(),
      last_mongo_id: lastMongoId || null,
      meta,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'stream' });
    return;
  }
  await queryPg(
    `insert into supabase_sync_state (stream, last_synced_at, last_mongo_id, meta, updated_at)
     values ($1, now(), $2, $3::jsonb, now())
     on conflict (stream) do update set
       last_synced_at = now(),
       last_mongo_id = excluded.last_mongo_id,
       meta = excluded.meta,
       updated_at = now()`,
    [stream, lastMongoId || null, JSON.stringify(meta)]
  );
}

async function backfillCollection({
  stream,
  model,
  table,
}) {
  const cursorState = await getSyncCursor(stream);
  const filter = {};
  if (cursorState?.last_mongo_id && mongoose.Types.ObjectId.isValid(cursorState.last_mongo_id)) {
    filter._id = { $gt: new mongoose.Types.ObjectId(cursorState.last_mongo_id) };
  }

  let processed = 0;
  let lastId = cursorState?.last_mongo_id || null;

  while (true) {
    const batchFilter = { ...filter };
    if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
      batchFilter._id = { $gt: new mongoose.Types.ObjectId(lastId) };
    }

    const docs = await model.find(batchFilter).sort({ _id: 1 }).limit(BATCH_SIZE).lean();
    if (!docs.length) break;

    await insertMappedBatch(table, docs);
    lastId = docs[docs.length - 1]._id.toString();
    processed += docs.length;
    await setSyncCursor(stream, lastId, { processedBatch: docs.length });
  }

  return { stream, processed, lastId };
}

async function backfillLogsAndAudits() {
  if (!isSupabaseEnabled()) {
    return { skipped: true, reason: 'disabled' };
  }

  const results = [];
  results.push(await backfillCollection({ stream: 'app_logs', model: Log, table: 'app_logs' }));
  results.push(await backfillCollection({ stream: 'crm_audits', model: CRMAudit, table: 'crm_audits' }));
  results.push(await backfillCollection({ stream: 'xp_audit_logs', model: XPAuditLog, table: 'xp_audit_logs' }));
  results.push(await backfillCollection({ stream: 'qa_test_runs', model: QATestRun, table: 'qa_test_runs' }));

  const snapshots = await CRMStatSnapshot.find({}).lean();
  await mirrorCrmStatSnapshotsFromMongo(snapshots);
  await setSyncCursor('crm_stat_snapshots', null, { count: snapshots.length });

  logger.info('SupabaseSync', 'Backfill complete', { results });
  return { results, crmSnapshots: snapshots.length };
}

async function runFullSecondarySync() {
  const rollup = await syncMailRollupsForAllUsers();
  const logs = await backfillLogsAndAudits();
  return { rollup, logs };
}

module.exports = {
  backfillLogsAndAudits,
  backfillCollection,
  runFullSecondarySync,
  getSyncCursor,
  setSyncCursor,
};
