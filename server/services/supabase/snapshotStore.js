const { isSupabaseEnabled } = require('../../config/supabase');
const { queryPg } = require('./client');
const logger = require('../../utils/logger');

function scopeKeyFromRepId(repId) {
  return repId ? `rep:${repId.toString()}` : 'global';
}

async function upsertCrmStatSnapshot(repId, metrics) {
  if (!isSupabaseEnabled()) return { skipped: true };

  const repKey = repId ? repId.toString() : null;
  const scopeKey = scopeKeyFromRepId(repId);

  await queryPg(
    `insert into crm_stat_snapshots (rep_id, scope_key, metrics, updated_at)
     values ($1,$2,$3::jsonb,now())
     on conflict (rep_id, scope_key) do update set
       metrics = excluded.metrics,
       updated_at = now()`,
    [repKey, scopeKey, JSON.stringify(metrics)]
  );

  return { ok: true };
}

async function mirrorCrmStatSnapshotsFromMongo(docs) {
  if (!isSupabaseEnabled()) return { skipped: true };
  await Promise.all(docs.map((doc) => upsertCrmStatSnapshot(doc.repId, doc.metrics)));
  return { ok: true, count: docs.length };
}

async function readCrmStatSnapshot(repId = null) {
  const repKey = repId ? repId.toString() : null;
  const scopeKey = scopeKeyFromRepId(repId);
  const { rows } = await queryPg(
    `select metrics, updated_at from crm_stat_snapshots
     where rep_id is not distinct from $1 and scope_key = $2
     order by updated_at desc
     limit 1`,
    [repKey, scopeKey]
  );
  if (!rows.length) return null;
  return rows[0].metrics;
}

module.exports = {
  upsertCrmStatSnapshot,
  mirrorCrmStatSnapshotsFromMongo,
  readCrmStatSnapshot,
  scopeKeyFromRepId,
};
