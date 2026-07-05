#!/usr/bin/env node
/**
 * Backfill TenantMembership rows from User.tenantId (idempotent).
 * Usage: node server/scripts/migrateTenantMemberships.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { migrateAllUsersToMemberships } = require('../services/tenantMembershipService');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const result = await migrateAllUsersToMemberships();
  console.log('migrateTenantMemberships:', result);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
