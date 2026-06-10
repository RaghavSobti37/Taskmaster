const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  isSupabaseConfigured,
  isSupabaseEnabled,
} = require('../../config/supabase');
const { SUPABASE_DB_URL } = require('../../config/supabase');

let supabaseClient = null;
let pgPool = null;

function getSupabaseClient() {
  if (!isSupabaseConfigured() || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseClient;
}

function getPgPool() {
  if (!SUPABASE_DB_URL) return null;
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: SUPABASE_DB_URL,
      ssl: SUPABASE_DB_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 30_000,
    });
  }
  return pgPool;
}

async function queryPg(text, params = []) {
  const pool = getPgPool();
  if (!pool) {
    throw new Error('SUPABASE_DB_URL is not configured');
  }
  return pool.query(text, params);
}

async function pingSupabase() {
  if (!isSupabaseEnabled()) {
    return {
      ok: false,
      enabled: false,
      configured: isSupabaseConfigured(),
      message: 'Supabase secondary store disabled or not configured',
    };
  }

  const client = getSupabaseClient();
  const checks = {
    rest: { ok: false, message: null },
    postgres: { ok: false, message: null },
    storage: { ok: false, message: null },
  };

  if (client) {
    try {
      const { error } = await client.from('supabase_sync_state').select('stream').limit(1);
      if (error) {
        checks.rest = { ok: false, message: error.message };
      } else {
        checks.rest = { ok: true, message: 'REST API reachable' };
      }
    } catch (err) {
      checks.rest = { ok: false, message: err.message };
    }

    try {
      const { data, error } = await client.storage.listBuckets();
      if (error) {
        checks.storage = { ok: false, message: error.message };
      } else {
        checks.storage = {
          ok: true,
          message: `Storage reachable (${(data || []).length} buckets)`,
        };
      }
    } catch (err) {
      checks.storage = { ok: false, message: err.message };
    }
  } else {
    checks.rest = { ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY missing' };
    checks.storage = { ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY missing' };
  }

  if (SUPABASE_DB_URL) {
    try {
      await queryPg('select 1 as ok');
      checks.postgres = { ok: true, message: 'Postgres reachable' };
    } catch (err) {
      checks.postgres = { ok: false, message: err.message };
    }
  } else {
    checks.postgres = { ok: false, message: 'SUPABASE_DB_URL missing' };
  }

  const ok = checks.rest.ok || checks.postgres.ok;
  return {
    ok,
    enabled: true,
    configured: true,
    checks,
  };
}

async function closeSupabaseClients() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  supabaseClient = null;
}

module.exports = {
  getSupabaseClient,
  getPgPool,
  queryPg,
  pingSupabase,
  closeSupabaseClients,
};
