/**
 * One-time cleanup: delete all campaigns except KEEP_TITLE.
 * Usage: node scripts/keepOnlyCampaign.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const KEEP_TITLE = process.argv[2] || 'Artist Path Delay Email';

(async () => {
  const uri =
    process.env.MAIL_USE_PROD_DB === 'true' && process.env.MONGODB_URI_PROD
      ? process.env.MONGODB_URI_PROD
      : process.env.MONGODB_URI;

  await mongoose.connect(uri);
  const Campaign = require('../models/Campaign');
  const MailCampaign = require('../models/MailCampaign');
  const MailEvent = require('../models/MailEvent');

  const keepCore = await Campaign.findOne({ title: KEEP_TITLE }).setOptions({ bypassTenant: true });
  const keepMail = await MailCampaign.findOne({ title: KEEP_TITLE }).setOptions({ bypassTenant: true });

  if (!keepCore && !keepMail) {
    console.error(`Campaign not found: "${KEEP_TITLE}"`);
    process.exit(1);
  }

  const deleteCoreIds = (
    await Campaign.find({ title: { $ne: KEEP_TITLE } }).setOptions({ bypassTenant: true }).select('_id')
  ).map((c) => c._id);

  const deleteMailIds = (
    await MailCampaign.find({ title: { $ne: KEEP_TITLE } }).setOptions({ bypassTenant: true }).select('_id')
  ).map((c) => c._id);

  const allDeleteIds = [...deleteCoreIds, ...deleteMailIds];

  if (allDeleteIds.length) {
    await MailEvent.deleteMany({ campaignId: { $in: allDeleteIds } }).setOptions({ bypassTenant: true });
  }
  const r1 = await Campaign.deleteMany({ title: { $ne: KEEP_TITLE } }).setOptions({ bypassTenant: true });
  const r2 = await MailCampaign.deleteMany({ title: { $ne: KEEP_TITLE } }).setOptions({ bypassTenant: true });

  console.log(JSON.stringify({
    kept: KEEP_TITLE,
    keptCoreId: keepCore?._id?.toString(),
    deletedCampaigns: r1.deletedCount,
    deletedMailCampaigns: r2.deletedCount,
    deletedMailEventsFor: allDeleteIds.length,
  }));

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
