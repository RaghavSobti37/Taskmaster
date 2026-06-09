/**
 * Import org managed accounts from Google Sheet into OrgAccount collection.
 * Usage: node server/scripts/importOrgAccountsFromSheet.js [--dry-run]
 *
 * Share the sheet with: tsc-newsletter@tsc-website-470512.iam.gserviceaccount.com
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Department = require('../models/Department');
const { ADMIN_SLUG } = require('../utils/departmentPermissions');
const { importOrgAccountsFromSheet, SPREADSHEET_ID } = require('../services/orgAccountImportService');

const DRY_RUN = process.argv.includes('--dry-run');

async function resolveAdminUser() {
  const adminDept = await Department.findOne({ slug: ADMIN_SLUG }).select('_id');
  if (adminDept) {
    const adminUser = await User.findOne({ departmentId: adminDept._id });
    if (adminUser) return adminUser;
  }
  return User.findOne({});
}

async function run() {
  console.log(DRY_RUN ? '[DRY RUN]' : '', `Importing from sheet ${SPREADSHEET_ID}...`);

  await mongoose.connect(process.env.MONGODB_URI);
  const adminUser = await resolveAdminUser();
  if (!adminUser) throw new Error('No admin user found for attribution');

  const result = await importOrgAccountsFromSheet({ user: adminUser, dryRun: DRY_RUN });
  console.log(JSON.stringify(result, null, 2));

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Import failed:', err.message);
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  process.exit(1);
});
