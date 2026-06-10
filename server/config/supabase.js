/**
 * Supabase secondary-store configuration.
 * Mongo remains primary until explicit cutover + Mongo purge.
 */

function readBool(name, defaultValue = false) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function firstEnv(names = []) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

const SUPABASE_URL = firstEnv([
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
]);

const SUPABASE_SERVICE_ROLE_KEY = firstEnv([
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_KEY',
]);

const SUPABASE_ANON_KEY = firstEnv([
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
]);

const SUPABASE_DB_URL = firstEnv([
  'SUPABASE_DB_URL',
  'DATABASE_URL',
  'SUPABASE_POSTGRES_URL',
]);

const SUPABASE_BACKUP_BUCKET = (
  process.env.SUPABASE_BACKUP_BUCKET || 'taskmaster-backups'
).trim();

const SUPABASE_SECONDARY_ENABLED = readBool('SUPABASE_SECONDARY_ENABLED', true);

/** Render and other IPv4-only hosts cannot reach db.*.supabase.co (IPv6 direct). */
function preferRestPostgres() {
  const mode = String(process.env.SUPABASE_PG_MODE || '').trim().toLowerCase();
  if (mode === 'rest') return true;
  if (mode === 'pg' || mode === 'direct') return false;
  return (
    String(process.env.RENDER || '').toLowerCase() === 'true'
    || Boolean(process.env.RENDER_SERVICE_ID)
    || readBool('SUPABASE_FORCE_REST_PG', false)
  );
}

function getSupabaseProjectRef() {
  const fromUrl = String(SUPABASE_URL || '').match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (fromUrl?.[1]) return fromUrl[1];
  const fromDb = String(SUPABASE_DB_URL || '').match(/db\.([a-z0-9]+)\.supabase\.co/i);
  return fromDb?.[1] || '';
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_DB_URL));
}

function isSupabaseEnabled() {
  return SUPABASE_SECONDARY_ENABLED && isSupabaseConfigured();
}

function getSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    anonKey: SUPABASE_ANON_KEY,
    dbUrl: SUPABASE_DB_URL,
    backupBucket: SUPABASE_BACKUP_BUCKET,
    enabled: isSupabaseEnabled(),
    configured: isSupabaseConfigured(),
  };
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY,
  SUPABASE_DB_URL,
  SUPABASE_BACKUP_BUCKET,
  SUPABASE_SECONDARY_ENABLED,
  preferRestPostgres,
  getSupabaseProjectRef,
  isSupabaseConfigured,
  isSupabaseEnabled,
  getSupabaseConfig,
};
