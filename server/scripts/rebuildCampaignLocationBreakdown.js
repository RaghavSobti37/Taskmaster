/**
 * Rebuild campaign locationBreakdown from CRM registration (Lead/Person city),
 * not IP geo. Opens/clicks attributed to each recipient's registered location.
 *
 * Usage (repo root):
 *   node server/scripts/rebuildCampaignLocationBreakdown.js <campaignIdOrMongoId> [--dry-run] [--prod]
 *
 * DB: resolveMongoUri() from server/.env (MAIL_USE_PROD_DB=true or --prod uses MONGODB_URI_PROD).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { resolveMongoUri, assertSafeDbTarget } = require('../config/database');
const { resolveCampaignByParam } = require('../utils/resolveCampaign');
const { buildRegisteredLocationBreakdown } = require('../utils/campaignRegisteredLocation');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const useProd = argv.includes('--prod');
if (useProd) process.env.MAIL_USE_PROD_DB = 'true';

const args = argv.filter((a) => a !== '--dry-run' && a !== '--prod');
const campaignKey = args[0];

const summarizeBreakdown = (breakdown) =>
  Object.entries(breakdown || {})
    .map(([city, stats]) => ({
      city,
      opens: stats.opens || 0,
      clicks: stats.clicks || 0,
      total: (stats.opens || 0) + (stats.clicks || 0),
    }))
    .filter((r) => r.opens > 0 || r.clicks > 0)
    .sort((a, b) => b.total - a.total);

(async () => {
  if (!campaignKey) {
    console.error(
      'Usage: node server/scripts/rebuildCampaignLocationBreakdown.js <campaignIdOrMongoId> [--dry-run] [--prod]',
    );
    process.exit(1);
  }

  const { dbUri, source } = resolveMongoUri();
  if (!dbUri) {
    console.error('MONGODB_URI is not set (see server/.env)');
    process.exit(1);
  }

  assertSafeDbTarget(dbUri, { source });
  await mongoose.connect(dbUri);

  const resolved = await resolveCampaignByParam(campaignKey, { lean: true });
  if (!resolved) {
    console.error(`Campaign not found: ${campaignKey}`);
    process.exit(1);
  }

  const { campaign, Model } = resolved;
  const mongoId = campaign._id;
  const publicCampaignId = campaign.campaignId || null;
  const beforeBreakdown = summarizeBreakdown(
    campaign.locationBreakdown instanceof Map
      ? Object.fromEntries(campaign.locationBreakdown)
      : campaign.locationBreakdown,
  );

  console.log(
    `Campaign: ${campaign.title || campaign.name || mongoId} | _id=${mongoId} | campaignId=${publicCampaignId || '(legacy/none)'}`,
  );
  console.log(`DB source: ${source}`);
  console.log(`Mode: ${dryRun ? 'dry-run (no writes)' : 'apply'}`);
  console.log('Before locationBreakdown (stored):', JSON.stringify(beforeBreakdown, null, 2));

  const registered = await buildRegisteredLocationBreakdown(mongoId, campaign.recipients || []);
  const afterBreakdown = summarizeBreakdown(registered.locationBreakdown);
  console.log('After locationBreakdown (CRM registered):', JSON.stringify(afterBreakdown, null, 2));
  console.log(`Recipients with CRM city mapped: ${registered.emailCityMap.size}`);

  if (!dryRun) {
    await Model.updateOne(
      { _id: mongoId },
      { $set: { locationBreakdown: registered.locationBreakdown, timeSeries: registered.timeSeries } },
    ).setOptions({ bypassTenant: true });
    console.log('Campaign document updated (locationBreakdown + timeSeries).');
  } else {
    console.log('Dry-run complete - no Campaign writes.');
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
