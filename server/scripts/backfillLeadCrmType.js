/**
 * Backfill crmType: 'sales' on leads missing the field.
 * Run: node server/scripts/backfillLeadCrmType.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const result = await Lead.updateMany(
    { $or: [{ crmType: { $exists: false } }, { crmType: null }] },
    { $set: { crmType: 'sales' } },
    { bypassTenant: true }
  );
  console.log(`Backfilled crmType on ${result.modifiedCount} leads`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
