#!/usr/bin/env node
/**
 * Backfill Clerk Organizations for tenants missing clerkOrganizationId.
 *
 * Usage:
 *   node server/scripts/backfillClerkOrganizations.js              # dry-run (default)
 *   node server/scripts/backfillClerkOrganizations.js --dry-run
 *   node server/scripts/backfillClerkOrganizations.js --execute    # requires CLERK_SECRET_KEY
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { backfillClerkOrganizations } = require('../services/clerkBackfillService');

const execute = process.argv.includes('--execute');
const dryRun = !execute;

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const result = await backfillClerkOrganizations({ dryRun });
  console.log(JSON.stringify({
    mode: dryRun ? 'dry-run' : 'execute',
    scanned: result.scanned,
    created: result.created,
    skipped: result.skipped,
    failed: result.failed,
    rows: result.rows,
  }, null, 2));
  await mongoose.disconnect();

  if (result.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
