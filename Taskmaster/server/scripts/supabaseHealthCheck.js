#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { getSupabaseHealthReport } = require('../services/supabase/health');
const { closeSupabaseClients } = require('../services/supabase/client');

async function main() {
  const report = await getSupabaseHealthReport();
  console.log(JSON.stringify(report, null, 2));

  const ok = report.connection?.ok && report.tableCounts;
  await closeSupabaseClients();
  process.exit(ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error('Health check failed:', err.message);
  await closeSupabaseClients();
  process.exit(1);
});
