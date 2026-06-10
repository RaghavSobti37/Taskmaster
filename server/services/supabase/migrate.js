const fs = require('fs');
const path = require('path');
const { SUPABASE_DB_URL } = require('../../config/supabase');
const { queryPg, closeSupabaseClients } = require('./client');
const logger = require('../../utils/logger');

async function applySupabaseSchema() {
  if (!SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL is required to apply schema');
  }

  const schemaPath = path.join(__dirname, '../../supabase/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await queryPg(sql);
  logger.info('SupabaseMigrate', 'Schema applied successfully');
  return { success: true, schemaPath };
}

async function ensureBackupBucket(bucketName) {
  const { getSupabaseClient } = require('./client');
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to ensure storage bucket');
  }

  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) throw listError;

  const exists = (buckets || []).some((b) => b.name === bucketName);
  if (exists) {
    return { created: false, bucket: bucketName };
  }

  const { error: createError } = await client.storage.createBucket(bucketName, {
    public: false,
  });
  if (createError) throw createError;

  return { created: true, bucket: bucketName };
}

async function runSupabaseSetup() {
  const result = {
    schema: null,
    bucket: null,
  };

  try {
    result.schema = await applySupabaseSchema();
    const { SUPABASE_BACKUP_BUCKET } = require('../../config/supabase');
    result.bucket = await ensureBackupBucket(SUPABASE_BACKUP_BUCKET);
    return { success: true, ...result };
  } finally {
    await closeSupabaseClients();
  }
}

module.exports = {
  applySupabaseSchema,
  ensureBackupBucket,
  runSupabaseSetup,
};
