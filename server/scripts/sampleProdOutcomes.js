require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CampaignChannelOutcome = require('../models/CampaignChannelOutcome');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI_PROD.trim());
  const opts = { skipTenantFilter: true };
  const sample = await CampaignChannelOutcome.find({})
    .limit(3)
    .select('campaignName phone name status failureReason sourceFilename metadata')
    .lean()
    .setOptions(opts);
  console.log(JSON.stringify(sample, null, 2));
  await mongoose.disconnect();
}

main();
