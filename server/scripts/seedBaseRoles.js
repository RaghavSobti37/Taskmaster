#!/usr/bin/env node
/**
 * Ensure the five base org roles exist (admin, artist-management, ops, sales, creative).
 * Idempotent — safe to run on every deploy or locally.
 *
 * Usage:
 *   node server/scripts/seedBaseRoles.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { seedDepartments, DEFAULT_DEPARTMENTS } = require('../services/departmentService');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const depts = await seedDepartments();
  const slugs = depts.map((d) => d.slug);
  const expected = DEFAULT_DEPARTMENTS.map((d) => d.slug);
  const missing = expected.filter((s) => !slugs.includes(s));
  if (missing.length) {
    console.warn('Warning: missing base role slugs after seed:', missing.join(', '));
  } else {
    console.log('Base roles ready:', expected.join(', '));
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
