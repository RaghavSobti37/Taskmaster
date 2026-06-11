const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const MailEvent = require('../models/MailEvent');
const { aggregateWithTenant } = require('../../../repositories/aggregateWithTenant');

const engagedRecipientPipeline = [
  { $unwind: '$recipients' },
  {
    $match: {
      'recipients.status': { $in: ['Opened', 'Clicked', 'Sent'] },
      'recipients.email': { $type: 'string', $ne: '' },
    },
  },
  {
    $group: {
      _id: { $toLower: { $trim: { input: '$recipients.email' } } },
    },
  },
];

async function getEngagedEmails() {
  const [coreRecipientEmails, mailRecipientEmails, eventEmails] = await Promise.all([
    aggregateWithTenant(Campaign, engagedRecipientPipeline),
    aggregateWithTenant(MailCampaign, engagedRecipientPipeline),
    aggregateWithTenant(MailEvent, [
      { $match: { eventType: { $in: ['Open', 'Click', 'Send'] }, email: { $type: 'string', $ne: '' } } },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$email' } } },
        },
      },
    ]),
  ]);

  const engagedEmailsSet = new Set();
  for (const row of [...coreRecipientEmails, ...mailRecipientEmails, ...eventEmails]) {
    if (row._id) engagedEmailsSet.add(row._id);
  }
  return Array.from(engagedEmailsSet);
}

async function getCumulativeTagMetrics(userId) {
  const [coreAgg, mailAgg] = await Promise.all([
    aggregateWithTenant(Campaign, [
      { $match: { createdBy: userId } },
      {
        $group: {
          _id: { $ifNull: ['$eventTag', 'General'] },
          totalSent: { $sum: { $ifNull: ['$metrics.totalSent', 0] } },
          totalOpens: { $sum: { $ifNull: ['$metrics.opened', 0] } },
          totalClicks: { $sum: { $ifNull: ['$metrics.clicked', 0] } },
        },
      },
    ]),
    aggregateWithTenant(MailCampaign, [
      { $match: { createdBy: userId } },
      {
        $group: {
          _id: { $ifNull: ['$eventTag', 'General'] },
          totalSent: { $sum: { $ifNull: ['$stats.sent', 0] } },
          totalOpens: { $sum: { $ifNull: ['$stats.opened', 0] } },
          totalClicks: { $sum: { $ifNull: ['$stats.clicked', 0] } },
        },
      },
    ]),
  ]);
  return { coreAgg, mailAgg };
}

async function getUserCampaignRecipients(userId) {
  const [coreCamps, mailCamps] = await Promise.all([
    Campaign.find({ createdBy: userId }, 'recipients').lean(),
    MailCampaign.find({ createdBy: userId }, 'recipients').lean(),
  ]);
  return { coreCamps, mailCamps };
}

module.exports = {
  getEngagedEmails,
  getCumulativeTagMetrics,
  getUserCampaignRecipients,
};
