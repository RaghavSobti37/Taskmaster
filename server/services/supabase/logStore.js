const { isSupabaseEnabled } = require('../../config/supabase');
const { insertMappedBatch } = require('./batchInsert');
const logger = require('../../utils/logger');

function mongoId(doc) {
  return doc?._id?.toString?.() || doc?.id || null;
}

async function insertMappedDoc(table, doc) {
  if (!isSupabaseEnabled()) return { skipped: true };
  const plain = doc?.toObject ? doc.toObject() : doc;
  if (!mongoId(plain)) return { skipped: true, reason: 'missing id' };
  await insertMappedBatch(table, [plain]);
  return { ok: true };
}

async function insertAppLog(doc) {
  return insertMappedDoc('app_logs', doc);
}

async function insertSystemLog(doc) {
  return insertMappedDoc('system_logs', doc);
}

async function insertCrmAudit(doc) {
  return insertMappedDoc('crm_audits', doc);
}

async function insertXpAuditLog(doc) {
  return insertMappedDoc('xp_audit_logs', doc);
}

async function insertQaTestRun(doc) {
  return insertMappedDoc('qa_test_runs', doc);
}

function mirrorAsync(fn, doc) {
  setImmediate(() => {
    fn(doc).catch((err) => {
      logger.warn('SupabaseLogMirror', 'Mirror write failed', { error: err.message });
    });
  });
}

module.exports = {
  insertAppLog,
  insertSystemLog,
  insertCrmAudit,
  insertXpAuditLog,
  insertQaTestRun,
  mirrorAsync,
};
