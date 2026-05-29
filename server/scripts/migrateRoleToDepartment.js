/**
 * One-time migration: map User.role → User.departmentId, then remove role field.
 * Usage: node server/scripts/migrateRoleToDepartment.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const { ROLE_TO_SLUG } = require('../utils/departmentPermissions');
const { seedDepartments } = require('../services/departmentService');

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected. Seeding departments if needed...');
  await seedDepartments();

  const deptsBySlug = Object.fromEntries(
    (await Department.find().lean()).map((d) => [d.slug, d._id])
  );

  const users = await User.collection.find({}).toArray();
  let backfilled = 0;
  let skipped = 0;
  let unmapped = 0;

  for (const u of users) {
    if (u.departmentId) {
      skipped++;
      continue;
    }
    const slug = ROLE_TO_SLUG[u.role];
    if (!slug) {
      if (u.role && u.role !== 'user') {
        console.warn(`No slug mapping for role "${u.role}" on ${u.email}`);
        unmapped++;
      }
      continue;
    }
    const deptId = deptsBySlug[slug];
    if (!deptId) {
      console.warn(`Department slug "${slug}" not found for ${u.email}`);
      unmapped++;
      continue;
    }
    await User.collection.updateOne({ _id: u._id }, { $set: { departmentId: deptId } });
    backfilled++;
    console.log(`  ${u.email}: role "${u.role}" → department ${slug}`);
  }

  const unset = await User.collection.updateMany({}, { $unset: { role: '' } });
  console.log(`Done. backfilled=${backfilled}, already had dept=${skipped}, unmapped=${unmapped}, role unset=${unset.modifiedCount}`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
