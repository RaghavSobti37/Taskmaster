/**
 * Verify campaign location breakdown has no Unknown labels and totals match MailEvents.
 * Usage: node server/scripts/verifyCampaignLocationCoverage.js [--prod] [--limit=5]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { resolveMongoUri, assertSafeDbTarget } = require('../config/database');
const Campaign = require('../domains/mail/models/Campaign');
const MailEvent = require('../domains/mail/models/MailEvent');
const {
  buildRegisteredLocationBreakdown,
  assertNoUnknownInBreakdown,
} = require('../utils/campaignRegisteredLocation');
const { isBreakdownPlaceLabel, isDatacenterCityLabel } = require('../utils/geoLookup');

const BYPASS = { bypassTenant: true };
const argv = process.argv.slice(2);
if (argv.includes('--prod')) process.env.MAIL_USE_PROD_DB = 'true';
const limit = Math.max(1, parseInt(argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '5', 10));

(async () => {
  const { dbUri, source } = resolveMongoUri();
  if (!dbUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  assertSafeDbTarget(dbUri, { source });
  await mongoose.connect(dbUri);

  const campaigns = await Campaign.find({})
    .select('title campaignId metrics stats')
    .sort({ 'metrics.opened': -1, createdAt: -1 })
    .limit(limit)
    .setOptions(BYPASS)
    .lean();

  let failures = 0;

  for (const camp of campaigns) {
    const eventAgg = await MailEvent.aggregate([
      { $match: { campaignId: camp._id, eventType: { $in: ['Open', 'Click'] } } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]).option(BYPASS);

    const eventOpens = eventAgg.find((r) => r._id === 'Open')?.count || 0;
    const eventClicks = eventAgg.find((r) => r._id === 'Click')?.count || 0;

    const registered = await buildRegisteredLocationBreakdown(camp._id, []);
    const rows = registered.locationBreakdownRows || [];
    const breakdownOpens = rows.reduce((s, r) => s + (r.opens || 0), 0);
    const breakdownClicks = rows.reduce((s, r) => s + (r.clicks || 0), 0);
    const badRow = rows.find((r) => !isBreakdownPlaceLabel(r.location || r.city));
    const datacenterRow = rows.find((r) => isDatacenterCityLabel(r.location || r.city));
    const coverage = registered.locationCoverage || assertNoUnknownInBreakdown(registered.locationBreakdown, []);

    const pass = coverage.ok
      && !badRow
      && !datacenterRow
      && breakdownOpens <= eventOpens
      && breakdownClicks <= eventClicks;

    if (!pass) failures += 1;

    console.log(JSON.stringify({
      title: camp.title,
      campaignId: camp.campaignId,
      mailEvents: { opens: eventOpens, clicks: eventClicks },
      breakdownTotals: { opens: breakdownOpens, clicks: breakdownClicks },
      cityCount: rows.length,
      topCities: rows.slice(0, 6).map((r) => ({ city: r.city, opens: r.opens, clicks: r.clicks })),
      coverage,
      hasBadRow: Boolean(badRow),
      hasDatacenterRow: Boolean(datacenterRow),
      pass,
    }, null, 2));
  }

  await mongoose.disconnect();
  if (failures > 0) {
    console.error(`\n${failures} campaign(s) failed location coverage verification.`);
    process.exit(1);
  }
  console.log(`\nAll ${campaigns.length} campaign(s) passed — real cities only, no datacenter/country labels.`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
