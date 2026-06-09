/**
 * Rebuild locationBreakdown (and optional MailEvent click cities) for one campaign
 * using trusted click geo from server/utils/geoLookup.js.
 *
 * Usage (repo root):
 *   node server/scripts/rebuildCampaignLocationBreakdown.js <campaignIdOrMongoId> [--dry-run]
 *
 * Loads MONGODB_URI from server/.env (or MONGODB_URI_PROD when MAIL_USE_PROD_DB=true).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { resolveCampaignByParam } = require('../utils/resolveCampaign');
const {
  buildGeoFromMailEvents,
  planClickMailEventLocationFixes,
} = require('../utils/campaignLocationGeo');
const MailEvent = require('../models/MailEvent');

const args = process.argv.slice(2).filter((a) => a !== '--dry-run');
const dryRun = process.argv.includes('--dry-run');
const campaignKey = args[0];

const summarizeBreakdown = (breakdown) =>
  Object.entries(breakdown || {})
    .map(([city, stats]) => ({ city, opens: stats.opens || 0, clicks: stats.clicks || 0 }))
    .sort((a, b) => b.clicks + b.opens - (a.clicks + a.opens));

(async () => {
  if (!campaignKey) {
    console.error('Usage: node server/scripts/rebuildCampaignLocationBreakdown.js <campaignIdOrMongoId> [--dry-run]');
    process.exit(1);
  }

  const uri =
    process.env.MAIL_USE_PROD_DB === 'true' && process.env.MONGODB_URI_PROD
      ? process.env.MONGODB_URI_PROD
      : process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI is not set (see server/.env)');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const resolved = await resolveCampaignByParam(campaignKey, { lean: false });
  if (!resolved?.campaign) {
    console.error(`Campaign not found: ${campaignKey}`);
    process.exit(1);
  }

  const { campaign, Model } = resolved;
  const campaignId = campaign._id;
  const beforeBreakdown = summarizeBreakdown(
    campaign.locationBreakdown instanceof Map
      ? Object.fromEntries(campaign.locationBreakdown)
      : campaign.locationBreakdown
  );

  console.log(`Campaign: ${campaign.title || campaign.name || campaignId} (${campaignId})`);
  console.log(`Mode: ${dryRun ? 'dry-run (no writes)' : 'apply'}`);
  console.log('Before locationBreakdown:', JSON.stringify(beforeBreakdown, null, 2));

  const clickFixes = await planClickMailEventLocationFixes(campaignId);
  console.log(`Click MailEvents to update: ${clickFixes.length}`);
  if (clickFixes.length) {
    console.log(JSON.stringify(clickFixes.slice(0, 20), null, 2));
    if (clickFixes.length > 20) console.log(`... and ${clickFixes.length - 20} more`);
  }

  if (!dryRun && clickFixes.length) {
    for (const fix of clickFixes) {
      const update = fix.newCity
        ? { $set: { 'location.city': fix.newCity } }
        : { $unset: { 'location.city': '' } };
      await MailEvent.updateOne({ _id: fix.eventId }, update).setOptions({ bypassTenant: true });
    }
  }

  const geo = await buildGeoFromMailEvents(campaignId);
  const afterBreakdown = summarizeBreakdown(geo.locationBreakdown);
  console.log('After locationBreakdown:', JSON.stringify(afterBreakdown, null, 2));

  if (!dryRun) {
    await Model.updateOne(
      { _id: campaignId },
      { $set: { locationBreakdown: geo.locationBreakdown, timeSeries: geo.timeSeries } },
    ).setOptions({ bypassTenant: true });
    console.log('Campaign document updated (locationBreakdown + timeSeries).');
  } else {
    console.log('Dry-run complete — no MailEvent or Campaign writes.');
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
