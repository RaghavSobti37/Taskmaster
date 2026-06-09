/**
 * Campaign geo from CRM registration (Lead/Person city), not IP tracking.
 * Opens/clicks attributed to each recipient's registered location.
 */
const MailEvent = require('../models/MailEvent');
const Lead = require('../models/Lead');
const PersonIndex = require('../models/PersonIndex');

const BYPASS = { bypassTenant: true };

const normalizeRegisteredLocation = (raw) =>
  String(raw || 'unknown')
    .toLowerCase()
    .replace(/[().,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const formatRegisteredLocationLabel = (raw) => {
  const normalized = normalizeRegisteredLocation(raw);
  if (!normalized || normalized === 'unknown') return 'Unknown';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const registeredCityFromLeadDoc = (doc) => {
  if (!doc) return null;
  const raw = doc.location || doc.city;
  if (!raw || !String(raw).trim()) return null;
  return formatRegisteredLocationLabel(raw);
};

/** Map lowercase emails to registered CRM city labels. */
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

  const leads = await Lead.find({ email: { $in: missing } })
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
    const persons = await PersonIndex.find({ email: { $in: stillMissing } })
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

const attributeEventsToBreakdown = (events, emailCityMap) => {
  const locationBreakdown = {};
  const engagedByCity = {};

  for (const evt of events) {
    const email = String(evt.email || '').toLowerCase().trim();
    if (!email) continue;
    const city = emailCityMap.get(email) || 'Unknown';
    if (!locationBreakdown[city]) locationBreakdown[city] = { opens: 0, clicks: 0 };
    if (evt.eventType === 'Open') locationBreakdown[city].opens++;
    else if (evt.eventType === 'Click') locationBreakdown[city].clicks++;
    if (!engagedByCity[city]) engagedByCity[city] = new Set();
    engagedByCity[city].add(email);
  }

  return { locationBreakdown, engagedByCity };
};

/**
 * @param {import('mongoose').Types.ObjectId} campaignId
 * @param {Array} recipients - campaign.recipients (leadId may be populated)
 */
const buildRegisteredLocationBreakdown = async (campaignId, recipients = []) => {
  const emailCityMap = await buildEmailRegisteredCityMap(recipients);

  const events = await MailEvent.find({
    campaignId,
    eventType: { $in: ['Open', 'Click'] },
  })
    .select('eventType email')
    .setOptions(BYPASS)
    .lean();

  const { locationBreakdown } = attributeEventsToBreakdown(events, emailCityMap);
  const timeSeries = await buildEngagementTimeSeries(campaignId);

  return { locationBreakdown, timeSeries, emailCityMap };
};

/** Cross-campaign: engaged emails → CRM cities with opens/clicks/count. */
const buildCumulativeRegisteredLocationBreakdown = async (engagedEmails = []) => {
  const emails = engagedEmails.map((e) => String(e || '').toLowerCase().trim()).filter(Boolean);
  const emailCityMap = await buildEmailRegisteredCityMap([], emails);

  const eventFilter = emails.length
    ? { email: { $in: emails }, eventType: { $in: ['Open', 'Click'] } }
    : { eventType: { $in: ['Open', 'Click'] } };

  const events = await MailEvent.find(eventFilter)
    .select('eventType email')
    .setOptions(BYPASS)
    .lean();

  const { locationBreakdown, engagedByCity } = attributeEventsToBreakdown(events, emailCityMap);

  const dynamicBreakdown = Object.entries(locationBreakdown)
    .map(([location, stats]) => ({
      location,
      count: engagedByCity[location]?.size || 0,
      opens: stats.opens || 0,
      clicks: stats.clicks || 0,
      total: (stats.opens || 0) + (stats.clicks || 0),
    }))
    .filter((r) => r.count > 0 || r.opens > 0 || r.clicks > 0)
    .sort((a, b) => b.total - a.total);

  return dynamicBreakdown;
};

module.exports = {
  normalizeRegisteredLocation,
  formatRegisteredLocationLabel,
  buildEmailRegisteredCityMap,
  buildRegisteredLocationBreakdown,
  buildEngagementTimeSeries,
  buildCumulativeRegisteredLocationBreakdown,
};
