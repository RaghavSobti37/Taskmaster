require('dotenv').config();
const mongoose = require('mongoose');
const { lookupGeoSync, lookupGeoAsync, resolveMailEventCity } = require('../utils/geoLookup');

const campaignIdParam = process.argv[2] || '8d7128a1d2ed468abe8a3064';

(async () => {
  const uri = process.env.MAIL_USE_PROD_DB === 'true' && process.env.MONGODB_URI_PROD
    ? process.env.MONGODB_URI_PROD
    : process.env.MONGODB_URI;
  await mongoose.connect(uri);
  const Campaign = require('../models/Campaign');
  const MailEvent = require('../models/MailEvent');

  const camp = await Campaign.findOne({ campaignId: campaignIdParam }).setOptions({ bypassTenant: true }).lean();
  if (!camp) {
    console.log('campaign not found for', campaignIdParam);
    process.exit(1);
  }
  console.log('campaign _id:', camp._id.toString());

  const events = await MailEvent.find({
    campaignId: camp._id,
    eventType: { $in: ['Open', 'Click'] },
  }).setOptions({ bypassTenant: true }).sort({ timestamp: -1 }).limit(10).lean();

  console.log('events:', events.length);
  for (const e of events) {
    const syncCity = resolveMailEventCity(e);
    let asyncCity = null;
    if (e.ipAddress) {
      const asyncGeo = await lookupGeoAsync(e.ipAddress);
      asyncCity = asyncGeo.city;
    }
    console.log(JSON.stringify({
      type: e.eventType,
      email: e.email,
      ipAddress: e.ipAddress,
      location: e.location,
      syncCity,
      asyncCity,
      ua: (e.userAgent || '').slice(0, 60),
    }, null, 2));
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
