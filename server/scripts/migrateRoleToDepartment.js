/**
 * Map legacy User.role → User.departmentId (raw collection; role may exist off-schema).
 *
 * Usage:
 *   node server/scripts/migrateRoleToDepartment.js           # local MONGODB_URI
 *   node server/scripts/migrateRoleToDepartment.js --prod    # MONGODB_URI_PROD
 *   node server/scripts/migrateRoleToDepartment.js --prod --force   # overwrite dept from role
 *   node server/scripts/migrateRoleToDepartment.js --prod --dry-run
 *   node server/scripts/migrateRoleToDepartment.js --prod --keep-role
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const { ROLE_TO_SLUG } = require('../utils/departmentPermissions');
const { seedDepartments } = require('../services/departmentService');

const args = new Set(process.argv.slice(2));
const useProd = args.has('--prod');
const force = args.has('--force');
const dryRun = args.has('--dry-run');
const keepRole = args.has('--keep-role');

async function migrate() {
  const uri = useProd
    ? process.env.MONGODB_URI_PROD
    : (process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URI_PROD);

  if (!uri) {
    console.error(useProd ? 'MONGODB_URI_PROD not set' : 'MONGODB_URI not set');
    process.exit(1);
  }

  console.log(`Target: ${useProd ? 'production' : 'local'}${dryRun ? ' (dry-run)' : ''}${force ? ' (force)' : ''}`);

  await mongoose.connect(uri.trim(), { serverSelectionTimeoutMS: 20000 });
  console.log('Connected. Seeding departments if needed...');
  await seedDepartments();

  const deptsBySlug = Object.fromEntries(
    (await Department.find().lean()).map((d) => [d.slug, d._id])
  );

  const users = await User.collection.find({}).toArray();
  let backfilled = 0;
  let skipped = 0;
  let unmapped = 0;
  let noRole = 0;

  for (const u of users) {
    const role = u.role;
    if (!role || role === 'user') {
      if (!u.departmentId) noRole++;
      if (u.departmentId) skipped++;
      continue;
    }

    if (u.departmentId && !force) {
      skipped++;
      continue;
    }

    const slug = ROLE_TO_SLUG[role];
    if (!slug) {
      console.warn(`No slug mapping for role "${role}" on ${u.email}`);
      unmapped++;
      continue;
    }

    const deptId = deptsBySlug[slug];
    if (!deptId) {
      console.warn(`Department slug "${slug}" not found for ${u.email}`);
      unmapped++;
      continue;
    }

    if (!dryRun) {
      await User.collection.updateOne({ _id: u._id }, { $set: { departmentId: deptId } });
    }
    backfilled++;
    const action = u.departmentId && force ? 'reassigned' : 'assigned';
    console.log(`  ${u.email}: role "${role}" → ${slug} (${action})`);
  }

  let unsetCount = 0;
  if (!dryRun && !keepRole) {
    const unset = await User.collection.updateMany({}, { $unset: { role: '' } });
    unsetCount = unset.modifiedCount;
  }

  console.log(
    `Done. assigned=${backfilled}, skipped(has dept${force ? '' : ', no force'})=${skipped}, ` +
      `no mappable role=${noRole}, unmapped=${unmapped}, role unset=${unsetCount}`
  );
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
