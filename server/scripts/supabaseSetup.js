#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { getSupabaseConfig } = require('../config/supabase');
const { runSupabaseSetup } = require('../services/supabase/migrate');

async function main() {
  const config = getSupabaseConfig();
  console.log('Supabase setup');
  console.log(`  URL: ${config.url || '(missing)'}`);
  console.log(`  DB URL: ${config.dbUrl ? 'set' : 'missing'}`);
  console.log(`  Service role key: ${config.serviceRoleKey ? 'set' : 'missing'}`);
  console.log(`  Bucket: ${config.backupBucket}`);

  if (!config.dbUrl) {
    console.error('\nSUPABASE_DB_URL is required. Get it from Supabase → Project Settings → Database → Connection string (URI).');
    process.exit(1);
  }

  const result = await runSupabaseSetup();
  console.log('\nSetup complete:', JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
