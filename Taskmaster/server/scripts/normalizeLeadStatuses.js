/** Normalize leadStatus casing in existing leads (e.g. warm → Warm). */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { canonicalLeadStatus } = require('../utils/crmPipelineFilters');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const leads = await Lead.find({ leadStatus: { $exists: true, $ne: null, $ne: '' } })
    .select('_id leadStatus')
    .setOptions({ bypassTenant: true });

  let updated = 0;
  for (const lead of leads) {
    const canonical = canonicalLeadStatus(lead.leadStatus);
    if (canonical !== lead.leadStatus) {
      lead.leadStatus = canonical;
      await lead.save();
      updated += 1;
    }
  }

  console.log(`Normalized leadStatus on ${updated} leads`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
