require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { repairCorruptLeadPhones, corruptPhoneQuery } = require('../services/leadPhoneRepair');
const Lead = require('../models/Lead');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD;
  if (!uri) {
    console.error('Set MONGODB_URI or MONGODB_URI_PROD in server/.env');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const before = await Lead.countDocuments(corruptPhoneQuery).setOptions({ bypassTenant: true });
  console.log(`Found ${before} leads with corrupt phone suffixes (-DUP- / EMPTY-).`);

  const stats = await repairCorruptLeadPhones();
  const after = await Lead.countDocuments(corruptPhoneQuery).setOptions({ bypassTenant: true });

  console.log('Repair complete:', stats);
  console.log(`Remaining corrupt phones: ${after}`);
  await mongoose.disconnect();
  process.exit(stats.errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
