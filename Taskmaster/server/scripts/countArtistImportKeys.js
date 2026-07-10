require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const total = await Lead.countDocuments({ crmType: 'artist' }).setOptions({ bypassTenant: true });
  const withKey = await Lead.countDocuments({
    crmType: 'artist',
    'metadata.importRowKey': { $exists: true, $ne: null },
  }).setOptions({ bypassTenant: true });
  const noEmail = await Lead.countDocuments({
    crmType: 'artist',
    email: { $exists: false },
  }).setOptions({ bypassTenant: true });
  console.log({ total, withImportRowKey: withKey, withoutEmail: noEmail });
  await mongoose.disconnect();
}

main();
