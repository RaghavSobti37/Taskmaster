/**
 * Campaign location breakdown — each open/click attributed to IP geolocation city.
 */
const MailEvent = require('../models/MailEvent');
const Lead = require('../models/Lead');
const PersonIndex = require('../models/PersonIndex');
const {
  isForbiddenBreakdownLabel,
  resolveEventCityForBreakdown,
  buildClickCityByEmailForBreakdown,
  buildIpPlaceMap,
  normalizeIp,
  eventIp,
} = require('./geoLookup');

const BYPASS = { bypassTenant: true };

const normalizeRegisteredLocation = (raw) =>
  String(raw || '')
    .toLowerCase()
    .replace(/[().,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const formatRegisteredLocationLabel = (raw) => {
  const normalized = normalizeRegisteredLocation(raw);
  if (!normalized || normalized === 'unknown') return null;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const registeredCityFromLeadDoc = (doc) => {
  if (!doc) return null;
  const raw = doc.location || doc.city;
  if (!raw || !String(raw).trim()) return null;
  return formatRegisteredLocationLabel(raw);
};

/** Map lowercase emails to CRM city labels (fallback when IP geo is missing). */
const buildEmailRegisteredCityMap = async (recipients = [], extraEmails = []) => {
  const map = new Map();

  const emails = [];
  for (const rec of recipients) {
    const email = String(rec?.email || '').toLowerCase().trim();
    if (!email) continue;
    emails.push(email);

    const fromPopulate = registeredCityFromLeadDoc(
      rec.leadId && typeof rec.leadId === 'object' ? rec.leadId : null,
    );
    if (fromPopulate) map.set(email, fromPopulate);
  }

  for (const raw of extraEmails) {
    const email = String(raw || '').toLowerCase().trim();
    if (email) emails.push(email);
  }

  const uniqueEmails = [...new Set(emails)];
  const missing = uniqueEmails.filter((e) => !map.has(e));
  if (!missing.length) return map;

  const leads = await Lead.find({
    $expr: { $in: [{ $toLower: '$email' }, missing] },
  })
    .select('email location city')
    .setOptions(BYPASS)
    .lean();

  for (const lead of leads) {
    const email = String(lead.email || '').toLowerCase().trim();
    if (!email || map.has(email)) continue;
    const city = registeredCityFromLeadDoc(lead);
    if (city) map.set(email, city);
  }

  const stillMissing = missing.filter((e) => !map.has(e));
  if (stillMissing.length) {
    const persons = await PersonIndex.find({
      $expr: { $in: [{ $toLower: '$email' }, stillMissing] },
    })
      .select('email city')
      .setOptions(BYPASS)
      .lean();

    for (const person of persons) {
      const email = String(person.email || '').toLowerCase().trim();
      if (!email || map.has(email)) continue;
      const city = registeredCityFromLeadDoc(person);
      if (city) map.set(email, city);
    }
  }

  return map;
};

const buildEngagementTimeSeries = async (campaignId) => {
  const events = await MailEvent.find({
    campaignId,
    eventType: { $in: ['Open', 'Click'] },
  })
    .select('eventType timestamp')
    .setOptions(BYPASS)
    .lean();

  const timeSeriesMap = {};
  for (const evt of events) {
    const date = new Date(evt.timestamp);
    if (Number.isNaN(date.getTime())) continue;
    const hourStr = `${String(date.getHours()).padStart(2, '0')}:00`;
    if (!timeSeriesMap[hourStr]) {
      timeSeriesMap[hourStr] = { time: date, opens: 0, clicks: 0 };
    }
    if (evt.eventType === 'Open') timeSeriesMap[hourStr].opens++;
    else if (evt.eventType === 'Click') timeSeriesMap[hourStr].clicks++;
  }

  return Object.values(timeSeriesMap).sort((a, b) => new Date(a.time) - new Date(b.time));
};

const attributeEventsToBreakdown = (events, eventCities = []) => {
  const locationBreakdown = {};
  const engagedByCity = {};

  for (let i = 0; i < events.length; i++) {
    const evt = events[i];
    const email = String(evt.email || '').toLowerCase().trim();
    if (!email) continue;

    const city = eventCities[i];
    if (!city || isForbiddenBreakdownLabel(city)) continue;

    if (!locationBreakdown[city]) locationBreakdown[city] = { opens: 0, clicks: 0 };
    if (evt.eventType === 'Open') locationBreakdown[city].opens++;
    else if (evt.eventType === 'Click') locationBreakdown[city].clicks++;
    if (!engagedByCity[city]) engagedByCity[city] = new Set();
    engagedByCity[city].add(email);
  }

  return { locationBreakdown, engagedByCity };
};

const resolveRegisteredCityForRecipient = async (rec, crmCityMap, ipCache) => {
  const email = String(rec?.email || '').toLowerCase().trim();
  if (!email) return 'Global';

  const syntheticEvt = {
    eventType: 'Open',
    email,
    ipAddress: rec?.lastOpenIp || rec?.ipAddress,
    location: rec?.location,
    metadata: rec?.metadata,
  };

  return resolveEventCityForBreakdown(syntheticEvt, { crmCityMap, ipCache });
};

/** Fallback when MailEvents are missing — group Opened/Clicked recipients by geo/CRM city. */
const attributeRecipientsToBreakdown = async (recipients = [], crmCityMap, ipCache = new Map()) => {
  const locationBreakdown = {};
  const engagedByCity = {};

  for (const rec of recipients) {
    const status = rec?.status;
    if (status !== 'Opened' && status !== 'Clicked') continue;

    const email = String(rec?.email || '').toLowerCase().trim();
    if (!email) continue;

    const city = await resolveRegisteredCityForRecipient(rec, crmCityMap, ipCache);
    if (!city || isForbiddenBreakdownLabel(city)) continue;

    if (!locationBreakdown[city]) locationBreakdown[city] = { opens: 0, clicks: 0 };
    if (status === 'Opened') locationBreakdown[city].opens += 1;
    if (status === 'Clicked') {
      locationBreakdown[city].clicks += 1;
      locationBreakdown[city].opens += 1;
    }
    if (!engagedByCity[city]) engagedByCity[city] = new Set();
    engagedByCity[city].add(email);
  }

  return { locationBreakdown, engagedByCity };
};

const enrichBreakdownWithCounts = (locationBreakdown, engagedByCity) => {
  const enriched = {};
  for (const [city, stats] of Object.entries(locationBreakdown || {})) {
    if (isForbiddenBreakdownLabel(city)) continue;
    enriched[city] = {
      opens: stats?.opens || 0,
      clicks: stats?.clicks || 0,
      count: engagedByCity[city]?.size || 0,
    };
  }
  return enriched;
};

const breakdownHasEngagement = (locationBreakdown = {}) =>
  Object.values(locationBreakdown).some(
    (stats) => (stats?.opens || 0) > 0 || (stats?.clicks || 0) > 0,
  );

const formatLocationBreakdownRows = (locationBreakdown = {}) =>
  Object.entries(locationBreakdown)
    .filter(([location]) => !isForbiddenBreakdownLabel(location))
    .map(([location, stats]) => ({
      location,
      city: location,
      count: stats?.count || 0,
      opens: stats?.opens || 0,
      clicks: stats?.clicks || 0,
      total: (stats?.opens || 0) + (stats?.clicks || 0),
    }))
    .filter((row) => row.count > 0 || row.opens > 0 || row.clicks > 0)
    .sort((a, b) => b.total - a.total);

const collectEngagementEventEmails = (events = []) =>
  [...new Set(
    events
      .map((evt) => String(evt?.email || '').toLowerCase().trim())
      .filter(Boolean),
  )];

const MAIL_EVENT_GEO_FIELDS = 'eventType email ipAddress userAgent location metadata timestamp';

const resolveEventCitiesForBreakdown = async (events, crmCityMap) => {
  const ipCache = new Map();
  const ipPlaceMap = await buildIpPlaceMap(events, ipCache);
  const clickCityByEmail = await buildClickCityByEmailForBreakdown(events, ipPlaceMap, ipCache);

  const cities = [];
  for (const evt of events) {
    const city = await resolveEventCityForBreakdown(evt, {
      crmCityMap,
      clickCityByEmail,
      ipPlaceMap,
      ipCache,
    });
    cities.push(city);
  }
  return cities;
};

const assertNoUnknownInBreakdown = (locationBreakdown = {}, eventCities = []) => {
  const badLabels = Object.keys(locationBreakdown).filter(isForbiddenBreakdownLabel);
  const badEvents = eventCities.filter(isForbiddenBreakdownLabel);
  return {
    ok: badLabels.length === 0 && badEvents.length === 0,
    badLabels,
    badEventCount: badEvents.length,
  };
};

/**
 * @param {import('mongoose').Types.ObjectId} campaignId
 * @param {Array} recipients - campaign.recipients (leadId may be populated)
 */
const buildRegisteredLocationBreakdown = async (campaignId, recipients = []) => {
  const events = await MailEvent.find({
    campaignId,
    eventType: { $in: ['Open', 'Click'] },
  })
    .select(MAIL_EVENT_GEO_FIELDS)
    .setOptions(BYPASS)
    .lean();

  const eventEmails = collectEngagementEventEmails(events);
  const crmCityMap = await buildEmailRegisteredCityMap(recipients, eventEmails);
  const eventCities = await resolveEventCitiesForBreakdown(events, crmCityMap);

  let { locationBreakdown, engagedByCity } = attributeEventsToBreakdown(events, eventCities);
  if (!breakdownHasEngagement(locationBreakdown) && recipients.length > 0) {
    const ipCache = new Map();
    ({ locationBreakdown, engagedByCity } = await attributeRecipientsToBreakdown(
      recipients,
      crmCityMap,
      ipCache,
    ));
  }

  const coverage = assertNoUnknownInBreakdown(locationBreakdown, eventCities);
  const enrichedBreakdown = enrichBreakdownWithCounts(locationBreakdown, engagedByCity);
  const timeSeries = await buildEngagementTimeSeries(campaignId);

  return {
    locationBreakdown: enrichedBreakdown,
    locationBreakdownRows: formatLocationBreakdownRows(enrichedBreakdown),
    timeSeries,
    emailCityMap: crmCityMap,
    locationCoverage: coverage,
  };
};

/** Cross-campaign: engaged emails → IP geo cities with opens/clicks/count. */
const buildCumulativeRegisteredLocationBreakdown = async (engagedEmails = []) => {
  const emails = engagedEmails.map((e) => String(e || '').toLowerCase().trim()).filter(Boolean);
  const crmCityMap = await buildEmailRegisteredCityMap([], emails);

  const eventFilter = emails.length
    ? { email: { $in: emails }, eventType: { $in: ['Open', 'Click'] } }
    : { eventType: { $in: ['Open', 'Click'] } };

  const events = await MailEvent.find(eventFilter)
    .select(MAIL_EVENT_GEO_FIELDS)
    .setOptions(BYPASS)
    .lean();

  const eventCities = await resolveEventCitiesForBreakdown(events, crmCityMap);
  const { locationBreakdown, engagedByCity } = attributeEventsToBreakdown(events, eventCities);
  const enrichedBreakdown = enrichBreakdownWithCounts(locationBreakdown, engagedByCity);
  return formatLocationBreakdownRows(enrichedBreakdown);
};

module.exports = {
  normalizeRegisteredLocation,
  formatRegisteredLocationLabel,
  collectEngagementEventEmails,
  buildEmailRegisteredCityMap,
  buildRegisteredLocationBreakdown,
  buildEngagementTimeSeries,
  buildCumulativeRegisteredLocationBreakdown,
  attributeEventsToBreakdown,
  attributeRecipientsToBreakdown,
  formatLocationBreakdownRows,
  enrichBreakdownWithCounts,
  resolveEventCitiesForBreakdown,
  assertNoUnknownInBreakdown,
};
