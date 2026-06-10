/**
 * Supabase PostgREST access for IPv4-only runtimes (Render).
 * Direct Postgres (db.*.supabase.co) is IPv6-only; HTTPS REST works on IPv4.
 */

const { getSupabaseClient } = require('./client');

function requireClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase REST client unavailable — set SUPABASE_URL + SUPABASE_SECRET_KEY');
  }
  return client;
}

async function upsertRows(table, rows, { onConflict, ignoreDuplicates = false } = {}) {
  if (!rows.length) return { count: 0 };
  const client = requireClient();
  const { error } = await client.from(table).upsert(rows, {
    onConflict,
    ignoreDuplicates,
  });
  if (error) throw error;
  return { count: rows.length };
}

async function selectRows(table, {
  columns = '*',
  filters = [],
  order,
  limit,
} = {}) {
  const client = requireClient();
  let query = client.from(table).select(columns);
  for (const [op, args] of filters) {
    if (op === 'eq') query = query.eq(...args);
    else if (op === 'is') query = query.is(...args);
    else if (op === 'in') query = query.in(...args);
    else if (op === 'gte') query = query.gte(...args);
    else if (op === 'lte') query = query.lte(...args);
  }
  if (order?.column) {
    query = query.order(order.column, { ascending: order.ascending !== false });
  }
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function deleteRows(table, filters = []) {
  const client = requireClient();
  let query = client.from(table).delete();
  for (const [op, args] of filters) {
    if (op === 'eq') query = query.eq(...args);
    else if (op === 'is') query = query.is(...args);
    else if (op === 'in') query = query.in(...args);
  }
  const { error } = await query;
  if (error) throw error;
}

async function countRows(table) {
  const client = requireClient();
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return Number(count || 0);
}

async function pingPostgresViaRest() {
  await selectRows('supabase_sync_state', { columns: 'stream', limit: 1 });
  return { ok: true, message: 'PostgREST reachable (IPv4)' };
}

module.exports = {
  upsertRows,
  selectRows,
  deleteRows,
  countRows,
  pingPostgresViaRest,
};
