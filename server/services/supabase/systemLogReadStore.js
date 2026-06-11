const { isLogsPrimarySupabase } = require('../../config/supabase');
const { preferRestPostgres, queryPg } = require('./client');
const { selectRows, countRows } = require('./restQuery');
const { SupabaseTimeoutError } = require('./withTimeout');
const logger = require('../../utils/logger');

function mapRowToApi(row) {
  if (!row) return null;
  return {
    _id: row.mongo_id,
    timestamp: row.timestamp,
    traceId: row.trace_id,
    contextId: row.context_id,
    severity: row.severity,
    module: row.module,
    message: row.message,
    userVisible: row.user_visible,
    actorId: row.actor_id,
    actorName: row.actor_name,
    route: row.route,
    method: row.method,
    httpStatus: row.http_status,
    errorCode: row.error_code,
    payload: row.payload,
    relatedEntities: row.related_entities,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
  };
}

function buildFilters({
  module,
  severity,
  traceId,
  search,
  from,
  to,
  tenantId,
  excludePageViews,
  errorCode,
}) {
  const filters = [];
  if (module) filters.push(['eq', ['module', module]]);
  if (severity) filters.push(['eq', ['severity', severity]]);
  if (traceId) filters.push(['eq', ['trace_id', traceId]]);
  if (errorCode) filters.push(['eq', ['error_code', errorCode]]);
  if (search) filters.push(['ilike', ['message', `%${search}%`]]);
  if (excludePageViews === true || excludePageViews === 'true') {
    filters.push(['neq', ['error_code', 'PAGE_VIEW']]);
  }
  if (from) filters.push(['gte', ['timestamp', new Date(from).toISOString()]]);
  if (to) filters.push(['lte', ['timestamp', new Date(to).toISOString()]]);
  if (tenantId) filters.push(['eq', ['tenant_id', tenantId]]);
  return filters;
}

async function querySystemLogsPg(filters, { skip = 0, limit = 50 } = {}) {
  const clauses = [];
  const params = [];
  let idx = 1;

  for (const [op, args] of filters) {
    const [column, value] = args;
    if (op === 'eq') {
      clauses.push(`${column} = $${idx++}`);
      params.push(value);
    } else if (op === 'neq') {
      clauses.push(`(${column} is distinct from $${idx++})`);
      params.push(value);
    } else if (op === 'gte') {
      clauses.push(`${column} >= $${idx++}`);
      params.push(value);
    } else if (op === 'lte') {
      clauses.push(`${column} <= $${idx++}`);
      params.push(value);
    } else if (op === 'ilike') {
      clauses.push(`${column} ilike $${idx++}`);
      params.push(value);
    }
  }

  const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
  const countSql = `select count(*)::bigint as count from system_logs ${where}`;
  const dataSql = `select * from system_logs ${where} order by timestamp desc limit $${idx++} offset $${idx++}`;
  params.push(limit, skip);

  const [{ rows: countRowsResult }, { rows }] = await Promise.all([
    queryPg(countSql, params.slice(0, params.length - 2)),
    queryPg(dataSql, params),
  ]);

  return {
    logs: rows.map(mapRowToApi),
    total: Number(countRowsResult[0]?.count || 0),
  };
}

async function querySystemLogs(filterInput, pagination = {}) {
  if (!isLogsPrimarySupabase()) {
    return null;
  }

  try {
    const filters = buildFilters(filterInput);
    const pageNum = Math.max(1, parseInt(pagination.page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    if (preferRestPostgres()) {
      const [rows, total] = await Promise.all([
        selectRows('system_logs', {
          filters,
          order: { column: 'timestamp', ascending: false },
          range: { from: skip, to: skip + limitNum - 1 },
        }),
        countRows('system_logs', filters),
      ]);
      return { logs: rows.map(mapRowToApi), total, page: pageNum, limit: limitNum };
    }

    const result = await querySystemLogsPg(filters, { skip, limit: limitNum });
    return { ...result, page: pageNum, limit: limitNum };
  } catch (err) {
    if (err instanceof SupabaseTimeoutError || err?.timedOut) {
      logger.warn('systemLogReadStore', 'Supabase read timed out — falling back to Mongo', {
        error: err.message,
      });
      return null;
    }
    throw err;
  }
}

async function getSystemLogTrail(traceId) {
  if (!isLogsPrimarySupabase() || !traceId) return null;

  if (preferRestPostgres()) {
    const rows = await selectRows('system_logs', {
      filters: [['eq', ['trace_id', traceId]]],
      order: { column: 'timestamp', ascending: true },
    });
    return rows.map(mapRowToApi);
  }

  const { rows } = await queryPg(
    'select * from system_logs where trace_id = $1 order by timestamp asc',
    [traceId]
  );
  return rows.map(mapRowToApi);
}

async function getTopPagesAnalytics({ days = 7, tenantId } = {}) {
  if (!isLogsPrimarySupabase()) return null;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  if (preferRestPostgres()) {
    const rows = await selectRows('system_logs', {
      columns: 'route, actor_id',
      filters: [
        ['eq', ['error_code', 'PAGE_VIEW']],
        ['gte', ['timestamp', since]],
        ...(tenantId ? [['eq', ['tenant_id', tenantId]]] : []),
      ],
      limit: 5000,
    });

    const byRoute = new Map();
    for (const row of rows) {
      const path = row.route || '(unknown)';
      const entry = byRoute.get(path) || { path, count: 0, users: new Set() };
      entry.count += 1;
      if (row.actor_id) entry.users.add(row.actor_id);
      byRoute.set(path, entry);
    }

    const pages = [...byRoute.values()]
      .map((entry) => ({
        path: entry.path,
        count: entry.count,
        uniqueUsers: entry.users.size,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return { days, pages };
  }

  const params = [since];
  let tenantClause = '';
  if (tenantId) {
    tenantClause = 'and tenant_id = $2';
    params.push(tenantId);
  }

  const { rows } = await queryPg(
    `select route as path, count(*)::int as count, count(distinct actor_id)::int as "uniqueUsers"
     from system_logs
     where error_code = 'PAGE_VIEW' and timestamp >= $1 ${tenantClause}
     group by route
     order by count desc
     limit 20`,
    params
  );

  return { days, pages: rows };
}

module.exports = {
  mapRowToApi,
  querySystemLogs,
  getSystemLogTrail,
  getTopPagesAnalytics,
};
