const { isSupabaseEnabled } = require('../../config/supabase');
const { queryPg } = require('./client');
const logger = require('../../utils/logger');

function toIso(value) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

function mongoId(doc) {
  return doc?._id?.toString?.() || doc?.id || null;
}

async function insertAppLog(doc) {
  if (!isSupabaseEnabled()) return { skipped: true };
  const plain = doc?.toObject ? doc.toObject() : doc;
  const id = mongoId(plain);
  if (!id) return { skipped: true, reason: 'missing id' };

  await queryPg(
    `insert into app_logs (
      mongo_id, timestamp, origin, actor_id, actor_role, action_type, target_entity,
      status, payload, execution_time_ms, user_id, action, details, target_id,
      target_type, tenant_id, created_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13::jsonb,$14,$15,$16,$17)
    on conflict (mongo_id) do nothing`,
    [
      id,
      toIso(plain.timestamp || plain.createdAt),
      plain.origin || null,
      plain.actorId || null,
      plain.actorRole || null,
      plain.actionType || plain.action || null,
      plain.targetEntity || plain.targetType || null,
      plain.status || null,
      JSON.stringify(plain.payload || null),
      plain.executionTimeMs ?? null,
      plain.userId?.toString?.() || plain.userId || null,
      plain.action || null,
      JSON.stringify(plain.details || null),
      plain.targetId?.toString?.() || plain.targetId || null,
      plain.targetType || null,
      plain.tenantId?.toString?.() || plain.tenantId || null,
      toIso(plain.createdAt || plain.timestamp),
    ]
  );
  return { ok: true };
}

async function insertSystemLog(doc) {
  if (!isSupabaseEnabled()) return { skipped: true };
  const plain = doc?.toObject ? doc.toObject() : doc;
  const id = mongoId(plain);
  if (!id) return { skipped: true, reason: 'missing id' };

  await queryPg(
    `insert into system_logs (
      mongo_id, timestamp, trace_id, context_id, severity, module, message,
      user_visible, actor_id, actor_name, route, method, http_status, error_code,
      payload, related_entities, tenant_id, created_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,$18)
    on conflict (mongo_id) do nothing`,
    [
      id,
      toIso(plain.timestamp || plain.createdAt),
      plain.traceId || null,
      plain.contextId || null,
      plain.severity,
      plain.module,
      plain.message,
      Boolean(plain.userVisible),
      plain.actorId || null,
      plain.actorName || null,
      plain.route || null,
      plain.method || null,
      plain.httpStatus ?? null,
      plain.errorCode || null,
      JSON.stringify(plain.payload || null),
      JSON.stringify(plain.relatedEntities || null),
      plain.tenantId?.toString?.() || plain.tenantId || null,
      toIso(plain.createdAt || plain.timestamp),
    ]
  );
  return { ok: true };
}

async function insertCrmAudit(doc) {
  if (!isSupabaseEnabled()) return { skipped: true };
  const plain = doc?.toObject ? doc.toObject() : doc;
  const id = mongoId(plain);
  if (!id) return { skipped: true, reason: 'missing id' };

  await queryPg(
    `insert into crm_audits (
      mongo_id, lead_id, lead_row_id, user_id, user_role, field_changed,
      old_value, new_value, timestamp, tenant_id, created_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    on conflict (mongo_id) do nothing`,
    [
      id,
      plain.leadId?.toString?.() || plain.leadId || null,
      plain.leadRowId || null,
      plain.userId?.toString?.() || String(plain.userId || ''),
      plain.userRole || null,
      plain.fieldChanged,
      plain.oldValue ?? null,
      plain.newValue ?? null,
      toIso(plain.timestamp),
      plain.tenantId?.toString?.() || plain.tenantId || null,
      toIso(plain.timestamp),
    ]
  );
  return { ok: true };
}

async function insertXpAuditLog(doc) {
  if (!isSupabaseEnabled()) return { skipped: true };
  const plain = doc?.toObject ? doc.toObject() : doc;
  const id = mongoId(plain);
  if (!id) return { skipped: true, reason: 'missing id' };

  await queryPg(
    `insert into xp_audit_logs (
      mongo_id, user_id, amount, action, details, previous_amount,
      recalculated_at, recalc_reason, created_at
    ) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)
    on conflict (mongo_id) do nothing`,
    [
      id,
      plain.userId?.toString?.() || plain.userId || 'unknown',
      plain.amount ?? 0,
      plain.action || 'UNKNOWN',
      JSON.stringify(plain.details || null),
      plain.previousAmount ?? null,
      plain.recalculatedAt ? toIso(plain.recalculatedAt) : null,
      plain.recalcReason || null,
      toIso(plain.createdAt),
    ]
  );
  return { ok: true };
}

async function insertQaTestRun(doc) {
  if (!isSupabaseEnabled()) return { skipped: true };
  const plain = doc?.toObject ? doc.toObject() : doc;
  const id = mongoId(plain);
  if (!id) return { skipped: true, reason: 'missing id' };

  await queryPg(
    `insert into qa_test_runs (
      mongo_id, status, started_at, completed_at, bugs_created,
      created_artifacts, cleanup_results, payload, created_at
    ) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)
    on conflict (mongo_id) do nothing`,
    [
      id,
      plain.status || null,
      plain.startedAt ? toIso(plain.startedAt) : null,
      plain.completedAt ? toIso(plain.completedAt) : null,
      Array.isArray(plain.bugsCreated) ? plain.bugsCreated.length : (plain.bugsIdentified ?? 0),
      JSON.stringify(plain.createdArtifacts || null),
      JSON.stringify(plain.cleanupResults || null),
      JSON.stringify(plain),
      toIso(plain.startedAt || plain.createdAt || new Date()),
    ]
  );
  return { ok: true };
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
