/**
 * Campaign open/click geo aggregation — shared by GET /api/campaigns/:id and rebuild scripts.
 * Keep in sync with email tracking rules in server/utils/geoLookup.js (locked pixel/base URL logic lives elsewhere).
 */
const MailEvent = require('../models/MailEvent');
const {
  resolveMailEventCityAsync,
  resolveClickEventCity,
  buildClickCityByEmail,
  isValidDisplayCity,
} = require('./geoLookup');

const buildGeoFromMailEvents = async (campaignId) => {
  const ipCache = new Map();
  const geoEvents = await MailEvent.find({
    campaignId,
    eventType: { $in: ['Open', 'Click'] },
  })
    .select('eventType timestamp email ipAddress location metadata userAgent')
    .setOptions({ bypassTenant: true })
    .lean();

  const clickCityByEmail = await buildClickCityByEmail(geoEvents, ipCache);
  const cityByEventId = new Map();

  const inferLocationTrust = (evt, displayCity) => {
    if (evt.eventType === 'Click') return displayCity ? 'verified' : 'none';
    if (evt.eventType !== 'Open') return 'none';
    if (!displayCity) return 'none';
    const email = String(evt.email || '').toLowerCase().trim();
    const clickCity = clickCityByEmail.get(email);
    if (clickCity && clickCity === displayCity) return 'inferred';
    if (evt.location?.city) return 'verified';
    return 'proxy';
  };

  const resolveEventCityCached = async (evt) => {
    const key = String(evt._id);
    if (cityByEventId.has(key)) return cityByEventId.get(key);
    const city = await resolveMailEventCityAsync(evt, ipCache, clickCityByEmail);
    cityByEventId.set(key, city);
    return city;
  };

  const locationBreakdown = {};
  const timeSeriesMap = {};

  for (const evt of geoEvents) {
    const city = await resolveEventCityCached(evt);
    if (city) {
      const trust = inferLocationTrust(evt, city);
      if (evt.eventType === 'Open' && trust === 'proxy') {
        /* skip proxy opens in geo charts */
      } else {
        if (!locationBreakdown[city]) locationBreakdown[city] = { opens: 0, clicks: 0 };
        if (evt.eventType === 'Open') locationBreakdown[city].opens++;
        else locationBreakdown[city].clicks++;
      }
    }

    const date = new Date(evt.timestamp);
    const hourStr = `${String(date.getHours()).padStart(2, '0')}:00`;
    if (!timeSeriesMap[hourStr]) {
      timeSeriesMap[hourStr] = { time: date, opens: 0, clicks: 0 };
    }
    if (evt.eventType === 'Open') {
      timeSeriesMap[hourStr].opens++;
    } else if (evt.eventType === 'Click') {
      timeSeriesMap[hourStr].clicks++;
    }
  }

  return {
    locationBreakdown,
    timeSeries: Object.values(timeSeriesMap).sort((a, b) => new Date(a.time) - new Date(b.time)),
  };
};

/** Re-resolve trusted click cities; returns rows needing MailEvent.location.city updates. */
const planClickMailEventLocationFixes = async (campaignId) => {
  const ipCache = new Map();
  const clicks = await MailEvent.find({
    campaignId,
    eventType: 'Click',
  })
    .select('_id email ipAddress location metadata userAgent')
    .setOptions({ bypassTenant: true })
    .lean();

  const fixes = [];
  for (const evt of clicks) {
    const oldCity = isValidDisplayCity(evt.location?.city) ? String(evt.location.city).trim() : null;
    const newCity = await resolveClickEventCity(evt, ipCache);
    const nextCity = newCity || null;
    if (oldCity === nextCity) continue;
    if (!oldCity && !nextCity) continue;
    fixes.push({
      eventId: evt._id,
      email: evt.email,
      oldCity,
      newCity: nextCity,
    });
  }
  return fixes;
};

module.exports = {
  buildGeoFromMailEvents,
  planClickMailEventLocationFixes,
};
