const MailEvent = require('../models/MailEvent');
const { aggregateWithTenant } = require('../../../repositories/aggregateWithTenant');

const emailRegex = (email) => new RegExp(`^${String(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

async function countByEmail(email) {
  if (!email) return 0;
  return MailEvent.countDocuments({ email: emailRegex(email) });
}

async function findByEmail(email, { limit = 100, sort = { timestamp: -1 } } = {}) {
  if (!email) return [];
  return MailEvent.find({ email: emailRegex(email) }).sort(sort).limit(limit).lean();
}

async function aggregateEventTypeCounts() {
  return aggregateWithTenant(MailEvent, [
    { $group: { _id: '$eventType', count: { $sum: 1 } } },
  ]);
}

async function distinctEmails({ since } = {}) {
  const filter = since ? { timestamp: { $gte: since } } : {};
  return MailEvent.distinct('email', filter);
}

async function getGeoCampaignAnalytics() {
  return aggregateWithTenant(MailEvent, [
    { $match: { eventType: { $in: ['Open', 'Click'] } } },
    {
      $group: {
        _id: { country: '$location.country', city: '$location.city' },
        totalOpens: { $sum: { $cond: [{ $eq: ['$eventType', 'Open'] }, 1, 0] } },
        totalClicks: { $sum: { $cond: [{ $eq: ['$eventType', 'Click'] }, 1, 0] } },
      },
    },
    { $sort: { totalClicks: -1, totalOpens: -1 } },
    { $limit: 20 },
  ]);
}

module.exports = {
  countByEmail,
  findByEmail,
  aggregateEventTypeCounts,
  distinctEmails,
  getGeoCampaignAnalytics,
};
