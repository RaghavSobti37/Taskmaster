const { isSupabaseEnabled } = require('../../config/supabase');
const { queryPg, preferRestPostgres } = require('./client');
const { upsertRows, selectRows } = require('./restQuery');
const logger = require('../../utils/logger');

function scopeKeyFromRepId(repId) {
  return repId ? `rep:${repId.toString()}` : 'global';
}

async function upsertCrmStatSnapshot(repId, metrics) {
  if (!isSupabaseEnabled()) return { skipped: true };

  const repKey = repId ? repId.toString() : null;
  const scopeKey = scopeKeyFromRepId(repId);

  if (preferRestPostgres()) {
    await upsertRows('crm_stat_snapshots', [{
      rep_id: repKey,
      scope_key: scopeKey,
      metrics,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'rep_id,scope_key' });
  } else {
    await queryPg(
      `insert into crm_stat_snapshots (rep_id, scope_key, metrics, updated_at)
       values ($1,$2,$3::jsonb,now())
       on conflict (rep_id, scope_key) do update set
         metrics = excluded.metrics,
         updated_at = now()`,
      [repKey, scopeKey, JSON.stringify(metrics)]
    );
  }

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
  if (preferRestPostgres()) {
    const repFilter = repKey == null
      ? ['is', ['rep_id', null]]
      : ['eq', ['rep_id', repKey]];
    const rows = await selectRows('crm_stat_snapshots', {
      columns: 'metrics,updated_at',
      filters: [
        ['eq', ['scope_key', scopeKey]],
        repFilter,
      ],
      order: { column: 'updated_at', ascending: false },
      limit: 1,
    });
    if (!rows.length) return null;
    return rows[0].metrics;
  }

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
