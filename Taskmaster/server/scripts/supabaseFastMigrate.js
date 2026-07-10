#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { runFastMigration } = require('../services/supabase/fastMigrate');
const { getSupabaseHealthReport } = require('../services/supabase/health');
const { closeSupabaseClients } = require('../services/supabase/client');

const useProd = process.argv.includes('--prod');

async function main() {
  const mongoUri = useProd
    ? (process.env.MONGODB_URI_PROD || '').trim()
    : (process.env.MONGODB_URI || '').trim();

  if (!mongoUri) {
    throw new Error(useProd ? 'MONGODB_URI_PROD is required' : 'MONGODB_URI is required');
  }

  const started = Date.now();
  console.log(`Fast Supabase migration starting (${useProd ? 'production' : 'local'} Mongo)`);

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 30_000,
    socketTimeoutMS: 120_000,
  });
  console.log('Mongo connected');

  const result = await runFastMigration();
  const health = await getSupabaseHealthReport();

  console.log('\n=== Migration result ===');
  console.log(JSON.stringify(result, null, 2));
  console.log('\n=== Supabase counts ===');
  console.log(JSON.stringify(health.tableCounts, null, 2));
  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  await mongoose.disconnect();
  await closeSupabaseClients();
  process.exit(health.connection?.ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error('Fast migration failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  await closeSupabaseClients();
  process.exit(1);
});
