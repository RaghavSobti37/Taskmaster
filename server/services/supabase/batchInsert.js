const { queryPg, preferRestPostgres } = require('./client');
const { upsertRows } = require('./restQuery');

function toIso(value) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

function mongoId(doc) {
  return doc?._id?.toString?.() || doc?.id || null;
}

async function insertRows(table, columns, rows, conflictTarget = 'mongo_id') {
  if (!rows.length) return 0;

  const flatParams = [];
  const valueGroups = rows.map((row, rowIndex) => {
    const placeholders = row.map((_, colIndex) => {
      flatParams.push(row[colIndex]);
      return `$${rowIndex * row.length + colIndex + 1}`;
    });
    return `(${placeholders.join(',')})`;
  });

  const sql = `insert into ${table} (${columns.join(',')})
    values ${valueGroups.join(',')}
    on conflict (${conflictTarget}) do nothing`;

  await queryPg(sql, flatParams);
  return rows.length;
}

function mapAppLogRow(plain) {
  const id = mongoId(plain);
  if (!id) return null;
  return [
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
  ];
}

function mapCrmAuditRow(plain) {
  const id = mongoId(plain);
  if (!id) return null;
  const ts = toIso(plain.timestamp);
  return [
    id,
    plain.leadId?.toString?.() || plain.leadId || null,
    plain.leadRowId || null,
    plain.userId?.toString?.() || String(plain.userId || ''),
    plain.userRole || null,
    plain.fieldChanged,
    plain.oldValue ?? null,
    plain.newValue ?? null,
    ts,
    plain.tenantId?.toString?.() || plain.tenantId || null,
    ts,
  ];
}

function mapXpAuditRow(plain) {
  const id = mongoId(plain);
  if (!id) return null;
  return [
    id,
    plain.userId?.toString?.() || plain.userId || 'unknown',
    plain.amount ?? 0,
    plain.action || 'UNKNOWN',
    JSON.stringify(plain.details || null),
    plain.previousAmount ?? null,
    plain.recalculatedAt ? toIso(plain.recalculatedAt) : null,
    plain.recalcReason || null,
    toIso(plain.createdAt),
  ];
}

function mapQaTestRunRow(plain) {
  const id = mongoId(plain);
  if (!id) return null;
  return [
    id,
    plain.status || null,
    plain.startedAt ? toIso(plain.startedAt) : null,
    plain.completedAt ? toIso(plain.completedAt) : null,
    Array.isArray(plain.bugsCreated) ? plain.bugsCreated.length : (plain.bugsIdentified ?? 0),
    JSON.stringify(plain.createdArtifacts || null),
    JSON.stringify(plain.cleanupResults || null),
    JSON.stringify(plain),
    toIso(plain.startedAt || plain.createdAt || new Date()),
  ];
}

const TABLE_MAPPERS = {
  app_logs: {
    columns: [
      'mongo_id', 'timestamp', 'origin', 'actor_id', 'actor_role', 'action_type', 'target_entity',
      'status', 'payload', 'execution_time_ms', 'user_id', 'action', 'details', 'target_id',
      'target_type', 'tenant_id', 'created_at',
    ],
    map: mapAppLogRow,
    castIndexes: { 8: 'jsonb', 12: 'jsonb' },
  },
  crm_audits: {
    columns: [
      'mongo_id', 'lead_id', 'lead_row_id', 'user_id', 'user_role', 'field_changed',
      'old_value', 'new_value', 'timestamp', 'tenant_id', 'created_at',
    ],
    map: mapCrmAuditRow,
  },
  xp_audit_logs: {
    columns: [
      'mongo_id', 'user_id', 'amount', 'action', 'details', 'previous_amount',
      'recalculated_at', 'recalc_reason', 'created_at',
    ],
    map: mapXpAuditRow,
    castIndexes: { 4: 'jsonb' },
  },
  qa_test_runs: {
    columns: [
      'mongo_id', 'status', 'started_at', 'completed_at', 'bugs_created',
      'created_artifacts', 'cleanup_results', 'payload', 'created_at',
    ],
    map: mapQaTestRunRow,
    castIndexes: { 5: 'jsonb', 6: 'jsonb', 7: 'jsonb' },
  },
};

function rowToObject(columns, row, castIndexes = {}) {
  const obj = {};
  columns.forEach((column, index) => {
    let value = row[index];
    if (castIndexes[index] === 'jsonb' && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        // keep string
      }
    }
    obj[column] = value;
  });
  return obj;
}

async function insertMappedBatch(table, docs) {
  const config = TABLE_MAPPERS[table];
  if (!config) throw new Error(`Unknown batch table: ${table}`);

  const rows = docs.map((doc) => config.map(doc?.toObject ? doc.toObject() : doc)).filter(Boolean);
  if (!rows.length) return 0;

  if (preferRestPostgres()) {
    const objects = rows.map((row) => rowToObject(config.columns, row, config.castIndexes));
    await upsertRows(table, objects, { onConflict: 'mongo_id', ignoreDuplicates: true });
    return rows.length;
  }

  const flatParams = [];
  const valueGroups = rows.map((row, rowIndex) => {
    const placeholders = row.map((value, colIndex) => {
      flatParams.push(value);
      const base = `$${rowIndex * row.length + colIndex + 1}`;
      const cast = config.castIndexes?.[colIndex];
      return cast ? `${base}::${cast}` : base;
    });
    return `(${placeholders.join(',')})`;
  });

  const sql = `insert into ${table} (${config.columns.join(',')})
    values ${valueGroups.join(',')}
    on conflict (mongo_id) do nothing`;

  await queryPg(sql, flatParams);
  return rows.length;
}

module.exports = {
  insertMappedBatch,
  insertRows,
};
