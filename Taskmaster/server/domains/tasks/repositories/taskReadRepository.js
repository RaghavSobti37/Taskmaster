/**
 * Hybrid read boundary for tasks (pilot).
 *
 * Pattern for other domains:
 * 1. Feature flag per domain (HYBRID_READ_{DOMAIN}=true)
 * 2. Try Supabase/PostgREST when enabled + table populated
 * 3. Fall back to Mongo tenant repository on miss/error
 * 4. Never remove Mongoose write paths in Phase 1
 *
 * Env: HYBRID_READ_TASKS=true + SUPABASE_SECONDARY_ENABLED + ETL-populated Task table
 */

const { isSupabaseEnabled } = require('../../../config/supabase');
const { selectRows } = require('../../../services/supabase/restQuery');
const { getSupabaseTableForEntity } = require('../../../../shared/dataOwnership');
const mongoTaskRepo = require('./taskRepository');
const logger = require('../../../utils/logger');

function isHybridReadEnabled() {
  const raw = String(process.env.HYBRID_READ_TASKS || '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function mapSupabaseRowToMongoShape(row) {
  if (!row) return null;
  const { id, createdAt, updatedAt, createdById, projectId, phaseId, parentTaskId, tenantId, ...rest } = row;
  return {
    ...rest,
    _id: id,
    tenantId,
    projectId: projectId || undefined,
    phaseId: phaseId || undefined,
    parentTaskId: parentTaskId || undefined,
    createdBy: createdById || undefined,
    createdAt: createdAt ? new Date(createdAt) : undefined,
    updatedAt: updatedAt ? new Date(updatedAt) : undefined,
    _readSource: 'supabase',
  };
}

async function findTaskByIdFromSupabase(id, options = {}) {
  const table = getSupabaseTableForEntity('Task');
  const filters = [['eq', ['id', String(id)]]];
  if (options.tenantId) {
    filters.push(['eq', ['tenantId', String(options.tenantId)]]);
  }
  const rows = await selectRows(table, { filters, limit: 1 });
  return mapSupabaseRowToMongoShape(rows[0]);
}

async function findById(id, options = {}) {
  if (!isHybridReadEnabled() || !isSupabaseEnabled()) {
    return mongoTaskRepo.findById(id, options).lean?.()
      ?? mongoTaskRepo.findById(id, options);
  }

  try {
    const fromSupabase = await findTaskByIdFromSupabase(id, options);
    if (fromSupabase) return fromSupabase;
  } catch (err) {
    logger.warn('taskReadRepository', 'Supabase read failed — Mongo fallback', {
      taskId: String(id),
      error: err.message,
    });
  }

  const query = mongoTaskRepo.findById(id, options);
  if (typeof query.lean === 'function') return query.lean();
  return query;
}

async function findOne(filter = {}, options = {}) {
  if (filter._id) return findById(filter._id, options);
  const query = mongoTaskRepo.findOne(filter, options);
  if (typeof query.lean === 'function') return query.lean();
  return query;
}

module.exports = {
  isHybridReadEnabled,
  findById,
  findOne,
  findTaskByIdFromSupabase,
  mapSupabaseRowToMongoShape,
};
