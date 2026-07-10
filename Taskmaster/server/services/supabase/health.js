const { getSupabaseConfig, preferRestPostgres } = require('../../config/supabase');
const { pingSupabase, queryPg } = require('./client');
const { countRows, selectRows } = require('./restQuery');

const COUNT_TABLES = [
  'backup_snapshots',
  'backup_files',
  'app_logs',
  'system_logs',
  'crm_audits',
  'xp_audit_logs',
  'qa_test_runs',
  'mail_event_tag_rollups',
  'mail_geo_rollups',
  'crm_stat_snapshots',
];

async function getTableCounts() {
  const counts = {};
  for (const table of COUNT_TABLES) {
    try {
      if (preferRestPostgres()) {
        counts[table] = await countRows(table);
      } else {
        const { rows } = await queryPg(`select count(*)::bigint as count from ${table}`);
        counts[table] = Number(rows[0]?.count || 0);
      }
    } catch (err) {
      counts[table] = { error: err.message };
    }
  }
  return counts;
}

async function getSupabaseHealthReport() {
  const config = getSupabaseConfig();
  const ping = await pingSupabase();

  const report = {
    configured: config.configured,
    enabled: config.enabled,
    url: config.url || null,
    backupBucket: config.backupBucket,
    hasServiceRoleKey: Boolean(config.serviceRoleKey),
    hasDbUrl: Boolean(config.dbUrl),
    connection: ping,
    tableCounts: null,
    latestBackup: null,
    latestRollup: null,
    latestCrmSnapshot: null,
  };

  if (!ping.ok || (!config.dbUrl && !preferRestPostgres())) {
    return report;
  }

  try {
    report.tableCounts = await getTableCounts();

    if (preferRestPostgres()) {
      const backupRows = await selectRows('backup_snapshots', {
        columns: 'snapshot_date,status,collection_count,total_bytes,created_at',
        order: { column: 'snapshot_date', ascending: false },
        limit: 1,
      });
      report.latestBackup = backupRows[0] || null;

      const rollupRows = await selectRows('mail_event_tag_rollups', {
        columns: 'rollup_date,user_id,synced_at',
        order: { column: 'synced_at', ascending: false },
        limit: 1,
      });
      report.latestRollup = rollupRows[0] || null;

      const crmRows = await selectRows('crm_stat_snapshots', {
        columns: 'rep_id,scope_key,updated_at',
        order: { column: 'updated_at', ascending: false },
        limit: 1,
      });
      report.latestCrmSnapshot = crmRows[0] || null;
    } else {
      const { rows: backupRows } = await queryPg(
        'select snapshot_date, status, collection_count, total_bytes, created_at from backup_snapshots order by snapshot_date desc limit 1'
      );
      report.latestBackup = backupRows[0] || null;

      const { rows: rollupRows } = await queryPg(
        'select rollup_date, user_id, synced_at from mail_event_tag_rollups order by synced_at desc limit 1'
      );
      report.latestRollup = rollupRows[0] || null;

      const { rows: crmRows } = await queryPg(
        'select rep_id, scope_key, updated_at from crm_stat_snapshots order by updated_at desc limit 1'
      );
      report.latestCrmSnapshot = crmRows[0] || null;
    }
  } catch (err) {
    report.dataError = err.message;
  }

  return report;
}

module.exports = {
  getSupabaseHealthReport,
  getTableCounts,
};
