require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CampaignChannelOutcome = require('../models/CampaignChannelOutcome');
const WhatsappCampaignRegistry = require('../models/WhatsappCampaignRegistry');

async function main() {
  const uri = (process.env.MONGODB_URI_PROD || '').trim();
  if (!uri) {
    console.error('MONGODB_URI_PROD not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const opts = { skipTenantFilter: true };
  const outcomes = await CampaignChannelOutcome.countDocuments().setOptions(opts);
  const reg = await WhatsappCampaignRegistry.countDocuments().setOptions(opts);
  const sample = await CampaignChannelOutcome.aggregate([
    { $group: { _id: '$campaignName', c: { $sum: 1 } } },
    { $sort: { c: -1 } },
    { $limit: 8 },
  ]).option(opts);
  const byStatus = await CampaignChannelOutcome.aggregate([
    { $group: { _id: '$status', c: { $sum: 1 } } },
    { $sort: { c: -1 } },
  ]).option(opts);
  console.log(JSON.stringify({ database: mongoose.connection.name, outcomes, reg, byStatus, topCampaigns: sample }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
