#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { resolveMongoUri } = require('../config/database');
const { runFullSecondarySync } = require('../services/supabase/syncService');
const { closeSupabaseClients } = require('../services/supabase/client');

async function main() {
  const { dbUri } = resolveMongoUri();
  await mongoose.connect(dbUri);
  console.log('Connected to Mongo for backfill');

  const result = await runFullSecondarySync();
  console.log(JSON.stringify(result, null, 2));

  await mongoose.disconnect();
  await closeSupabaseClients();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Backfill failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  await closeSupabaseClients();
  process.exit(1);
});
