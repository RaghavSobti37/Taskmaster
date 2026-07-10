require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const WhatsappCampaignRegistry = require('../models/WhatsappCampaignRegistry');

async function main() {
  const uri = (process.env.MONGODB_URI_PROD || '').trim();
  if (!uri) {
    console.error('MONGODB_URI_PROD not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const opts = { skipTenantFilter: true };
  const total = await WhatsappCampaignRegistry.countDocuments().setOptions(opts);
  const duplicateNames = await WhatsappCampaignRegistry.aggregate([
    { $group: { _id: '$campaignName', c: { $sum: 1 } } },
    { $match: { c: { $gt: 1 } } },
  ]).option(opts);
  const duplicateAisensyIds = await WhatsappCampaignRegistry.aggregate([
    { $match: { 'metadata.aisensyId': { $exists: true, $ne: null } } },
    { $group: { _id: '$metadata.aisensyId', c: { $sum: 1 } } },
    { $match: { c: { $gt: 1 } } },
  ]).option(opts);
  console.log(JSON.stringify({
    database: mongoose.connection.name,
    total,
    duplicateNames: duplicateNames.length,
    duplicateAisensyIds: duplicateAisensyIds.length,
  }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
