#!/usr/bin/env node
/**
 * Read-only Clerk ↔ Mongo sync inventory report.
 *
 * Usage:
 *   node server/scripts/inventoryClerkSync.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { inventoryClerkSync } = require('../services/clerkBackfillService');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const report = await inventoryClerkSync();
  console.log(JSON.stringify({
    tenantsMissingClerkOrganizationId: report.tenantsMissingClerkOrganizationId,
    usersMissingClerkId: report.usersMissingClerkId,
    activeMemberships: report.activeMemberships,
    membershipGaps: report.membershipGaps,
    tenantsMissingClerkOrganizationIdSample: report.tenantsMissingClerkOrganizationIdRows.slice(0, 20),
    usersMissingClerkIdSample: report.usersMissingClerkIdRows.slice(0, 20),
  }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
